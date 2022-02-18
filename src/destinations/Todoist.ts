import {
  TODOIST_API_KEY,
  TODOIST_CODE_REVIEW_PROJECT_NAME,
  TODOIST_LINEAR_ISSUES_PROJECT_NAME,
} from '../Constants';
import { createSpinner, Spinner } from 'nanospinner'
import { MergeRequest } from 'gitlab-graphql-types';
import { Issue } from '@linear/sdk';
import {
  TodoistApi,
  Project,
  Task,
  Label,
  AddTaskArgs,
  UpdateTaskArgs,
} from '@doist/todoist-api-typescript'

export class TodoistHelper {

  todoistClient: TodoistApi;
  todoistCodeReviewProjectName: string;
  todoistLinearIssuesProjectName: string;

  projects: Array<Project>;

  todoistTasksLinearIssues: Array<Task> = [];
  todoistTasksCodeReviews: Array<Task> = [];

  labels: Array<Label> = [];

  constructor() {
    this.todoistClient = new TodoistApi(TODOIST_API_KEY);
    this.todoistCodeReviewProjectName = TODOIST_CODE_REVIEW_PROJECT_NAME;
    this.todoistLinearIssuesProjectName = TODOIST_LINEAR_ISSUES_PROJECT_NAME;
  }

  init = async () => {
    let spinner = createSpinner('Fetching Todoist Projects..').start()
    this.projects = await this.todoistClient.getProjects();
    spinner.success();

    const linearIssuesProjectId = this.getTodoistProjectByName(
      this.todoistLinearIssuesProjectName, this.projects,
    )?.id;

    const codeReviewProjectId = this.getTodoistProjectByName(
      this.todoistCodeReviewProjectName, this.projects,
    )?.id;

    if (linearIssuesProjectId) {
      spinner = createSpinner('Fetching Todoist Ticket Tasks..').start()

      this.todoistTasksLinearIssues =  await this.todoistClient.getTasks(
        linearIssuesProjectId ? { projectId: linearIssuesProjectId } : {}
      );

      spinner.success();
    }

    if (codeReviewProjectId) {
      spinner = createSpinner('Fetching Todoist Code Review Tasks..').start()

      this.todoistTasksCodeReviews = await this.todoistClient.getTasks(
        codeReviewProjectId ? { projectId: codeReviewProjectId } : {}
      );

      spinner.success();
    }

    spinner = createSpinner('Fetching Todoist Labels..').start()
    this.labels = await this.todoistClient.getLabels();
    spinner.success();
  };

  getTodoistProjectByName = (name: string, projects: Array<Project>): Project|null => {
    return projects.filter(p => p.name == name)[0] || null;
  };

  getExistingTask = (name: string, tasks: Array<Task>): Task|null => {
    return tasks.filter(t => t.content == name)[0] || null;
  };

  getExistingLabelIfExists = (name: string, labels: Array<Label>): Label|null => {
    return labels.filter(l => l.name == name)[0] || null;
  };

  getOrCreateLabels = async (issue: Issue) => {
    const labelsRequest = await issue.labels();

    const labelsToCreate = [];

    const ids = labelsRequest.nodes.map(label => {
      const existingLabel = this.getExistingLabelIfExists(label.name, this.labels);

      if (!existingLabel) {
        // TODO return label id
        labelsToCreate.push(label.name);
      }
      return existingLabel.id;
    });

    labelsToCreate.map(async labelName => {
      const newLabel = await this.todoistClient.addLabel({name: labelName});
      console.log(newLabel);
    });

    return ids;
  };

}

let activeTodoistHelperInstance: TodoistHelper | undefined;

export const getTodoistHelper = () => {

	if (activeTodoistHelperInstance === undefined) {
		activeTodoistHelperInstance = new TodoistHelper();
	}
	return activeTodoistHelperInstance;
};
