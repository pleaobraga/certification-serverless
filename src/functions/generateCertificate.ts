import { S3 } from "aws-sdk";
import chromium from "chrome-aws-lambda";
import dayjs from "dayjs";
import fs from "fs";
import handlebars from "handlebars";
import path from "path";

import { document } from "../utils/dynamodbClient";

interface ICreateCertificate {
  id: string;
  name: string;
  grade: string;
}

interface ITemplate extends ICreateCertificate {
  date: string;
  medal: string;
}

const compile = async function (data: ITemplate) {
  const filepath = path.join(
    process.cwd(),
    "src",
    "templates",
    "certificate.hbs"
  );

  const html = fs.readFileSync(filepath, "utf-8");

  return handlebars.compile(html)(data);
};

export const handle = async (event) => {
  try {
    const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;

    const response = await document
      .query({
        TableName: "users_certificates",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: {
          ":id": id,
        },
      })
      .promise();

    const userAlreadyExists = response.Items[0];

    if (!userAlreadyExists) {
      await document
        .put({
          TableName: "users_certificates",
          Item: {
            id,
            name,
            grade,
          },
        })
        .promise();
    }

    const medalPath = path.join(process.cwd(), "src", "templates", "selo.png");
    const medal = fs.readFileSync(medalPath, "base64");

    const data: ITemplate = {
      date: dayjs().format("DD/MM/YYYY"),
      grade,
      name,
      id,
      medal,
    };

    const content = await compile(data);

    const browser = await chromium.puppeteer.launch({
      headless: true,
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
    });

    const page = await browser.newPage();

    await page.setContent(content);

    const pdf = await page.pdf({
      format: "a4",
      landscape: true,
      path: process.env.IS_OFFLINE ? "certificate.pdf" : null,
      printBackground: true,
      preferCSSPageSize: true,
    });

    await browser.close();

    const s3 = new S3();
    await s3
      .putObject({
        Bucket: "serverlesscertigficateignite",
        Key: `${id}.pdf`,
        ACL: "public-read",
        Body: pdf,
        ContentType: "application/pdf",
      })
      .promise();

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Certificate Created",
        url: `https://serverlesscertigficateignite.s3.us-west-1.amazonaws.com/${id}.pdf`,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: e.message,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};
