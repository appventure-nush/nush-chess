import {Client} from "pg";
import * as fs from "fs";

const config = JSON.parse(fs.readFileSync("./config.json", "ascii"))

function createConnectionOrNull() {
  if (!config.host || !config.user || !config.password || !config.database) {
    console.log("Database not connected, disabling logging.")
    return null;
  }
  const connection = new Client({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
  });

  connection.connect();
  return connection;
}

const connection = createConnectionOrNull();

export default connection;