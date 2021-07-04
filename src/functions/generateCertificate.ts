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

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Certificate Created",
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
