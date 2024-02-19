import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import simpleGit from "simple-git";
import { generateRandomID } from "./utils";
import path from "path";
import { getAllFiles } from "./file";
import { uploadFile } from "./aws";
import { createClient } from "redis";

const publisher = createClient();
publisher.connect();
const subscriber = createClient();
subscriber.connect();

const app = express();
dotenv.config({ path: __dirname + "/.env" });
app.use(cors()); // middleware to integrate backend with frontend (be and fe will be in different places)
app.use(express.json()); // middleware to read req.body

app.post("/deploy", async (req, res) => {
  const repoUrl = req.body.repoUrl;
  const id = generateRandomID();
  await simpleGit().clone(repoUrl, path.join(__dirname, `output/${id}`));

  const files = getAllFiles(path.join(__dirname, `output/${id}`));

  // To upload files to s3
  files.forEach(async (file) => {
    await uploadFile(file.slice(__dirname.length + 1), file);
  });

  // To add ID to queue
  publisher.lPush("build-queue", id);

  // To change status in DB
  publisher.hSet("status", id, "uploaded");

  res.json({
    id: id,
  });
});

app.get("/status", async (req, res) => {
  const id = req.query.id;
  const response = await subscriber.hGet("status", id as string);

  res.json({
    status: response,
  });
});

app.listen(3000);
