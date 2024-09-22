const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "ap-southeast-2" });
const ddb = DynamoDBDocumentClient.from(client);

const express = require("express");
const serverless = require("serverless-http");

const app = express();
app.use(express.json());

const USERS_TABLE = "User"; // Update with your actual table name
const COMPANY_TABLE = "Company"; // Update with your actual table name

// Success response utility function
const successResponse = (res, statusCode, message, data) => {
  return res.status(statusCode).json({ message, data });
};

// Update company info
// Main function to handle the PUT request
app.put("/companies/:companyId", async (req, res) => {
  const { id } = req.body;
  companyId = id ? Number(id) : null;
  const companyData = req.body;
  try {
    if (companyId) {
      const updatedAttributes = await updateCompany(companyId, companyData);
      return successResponse(
        res,
        200,
        "Company info updated successfully.",
        updatedAttributes
      );
    } else {
      const newCompany = await createCompany(companyData);
      return successResponse(
        res,
        201,
        "New company created successfully.",
        newCompany
      );
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Could not update or create company info" });
  }
});

// Get company details
app.get("/companies/:companyId", async (req, res) => {
  const { companyId } = req.params;

  try {
    const params = {
      TableName: COMPANY_TABLE,
      Key: { id: Number(companyId) },
    };

    const command = new GetCommand(params);
    const { Item } = await ddb.send(command);
    console.log("Item retrieved is: ", Item);
    if (Item) {
      return successResponse(
        res,
        200,
        "Company details retrieved successfully.",
        Item
      );
    } else {
      return res.status(404).json({ error: "Company not found" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not retrieve company" });
  }
});

app.get("/companies", async (req, res) => {
  const { pageNumber, pageLimit } = req.query;
  const limit = Number(pageLimit) || 10;
  const page = Number(pageNumber) || 1;

  try {
    const params = {
      TableName: COMPANY_TABLE,
    };

    const command = new ScanCommand(params);
    const { Items } = await ddb.send(command);

    const paginatedCompanies = Items.slice((page - 1) * limit, page * limit);
    return successResponse(res, 200, "Companies retrieved successfully", {
      page,
      limit,
      total: Items.length,
      companies: paginatedCompanies,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not retrieve companies" });
  }
});

app.put("/companies/:companyId/status", async (req, res) => {
  let { companyId } = req.params;
  companyId = Number(companyId);
  const { clientStatus } = req.body;

  try {
    const params = {
      TableName: COMPANY_TABLE,
      Key: { id: companyId },
      UpdateExpression: "set #clientStatus = :clientStatus",
      ExpressionAttributeNames: {
        "#clientStatus": "clientStatus",
      },
      ExpressionAttributeValues: {
        ":clientStatus": clientStatus,
      },
      ReturnValues: "ALL_NEW",
    };

    const command = new UpdateCommand(params);
    const { Attributes } = await ddb.send(command);

    return successResponse(
      res,
      200,
      "Updated company client status",
      Attributes
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not update client status" });
  }
});

app.get("/clients/active-pending", async (req, res) => {
  try {
    const params = {
      TableName: COMPANY_TABLE,
    };

    const command = new ScanCommand(params);
    const { Items } = await ddb.send(command);

    const totalCompanies = Items.length;
    const activeClients = Items.filter(
      (item) => item.clientStatus === true
    ).length;
    const pendingClients = totalCompanies - activeClients;

    return successResponse(res, 200, "Active and pending clients fetched.", {
      activeClients,
      pendingClients,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Could not fetch active and pending clients" });
  }
});

app.get("/test", (req, res) => {
  return res.json({
    message: "Serverless function running successfully",
  });
});

const updateCompany = async (companyId, companyData) => {
  delete companyData.id;
  const updateExpression = Object.keys(companyData)
    .map((key, index) => `#${key} = :value${index}`)
    .join(", ");

  const expressionAttributeNames = Object.fromEntries(
    Object.keys(companyData).map((key) => [`#${key}`, key])
  );

  const expressionAttributeValues = Object.fromEntries(
    Object.keys(companyData).map((key, index) => [
      `:value${index}`,
      companyData[key],
    ])
  );

  const params = {
    TableName: USERS_TABLE,
    Key: { id: companyId },
    UpdateExpression: `SET ${updateExpression}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  };

  const command = new UpdateCommand(params);
  const { Attributes } = await ddb.send(command);

  return Attributes;
};

const createCompany = async (companyData) => {
  const newCompanyParams = {
    TableName: COMPANY_TABLE,
    Item: { id: Math.floor(100000 + Math.random() * 900000), ...companyData },
  };

  const command = new PutCommand(newCompanyParams);
  await ddb.send(command);

  return newCompanyParams.Item;
};

exports.handler = serverless(app);
