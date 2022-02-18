import * as dotenv from "dotenv";
dotenv.config();

export const LINEAR_API_KEY = process.env["LINEAR_API_KEY"] || '';
export const TODOIST_API_KEY = process.env["TODOIST_API_KEY"] || '';
export const GITLAB_API_KEY = process.env["GITLAB_API_KEY"] || '';
export const GITLAB_USERNAME = process.env["GITLAB_USERNAME"] || '';
export const GITLAB_GROUP_NAME = process.env["GITLAB_GROUP_NAME"] || '';
