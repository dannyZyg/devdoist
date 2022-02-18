import { TODOIST_API_KEY, GITLAB_USERNAME } from './constants';
import { createSpinner } from 'nanospinner'
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
import { getLinearHelper } from './sources/Linear';
import { getGitlabHelper, GitlabHelper } from './sources/Gitlab';

export default async (): Promise<void> => {

  const todoistClient = new TodoistApi(TODOIST_API_KEY);

  let spinner = createSpinner('Fetching Todoist Projects..').start()
  const todoistProjects = await todoistClient.getProjects();
  spinner.success();

  const ticketCreationFilter: Array<Project> = todoistProjects.filter(p => p.name == "Ticket Creation");
  const getTodoistProjectByName = (name): Project|null => todoistProjects.filter(p => p.name == name)[0] || null;

  const ticketCreationProjectId = getTodoistProjectByName('Ticket Creation')?.id;
  const codeReviewProjectId = getTodoistProjectByName('Code Reviews')?.id;

  spinner = createSpinner('Fetching Todoist Code Review Tasks..').start()
  const codeReviewTasks: Array<Task> = await todoistClient.getTasks(
    ticketCreationProjectId ? { projectId: codeReviewProjectId } : {}
  );
  spinner.success();

  spinner = createSpinner('Fetching Todoist Ticket Tasks..').start()
  const ticketTasks: Array<Task> = await todoistClient.getTasks(
    ticketCreationProjectId ? { projectId: ticketCreationProjectId } : {}
  );
  spinner.success();

  spinner = createSpinner('Fetching Todoist Labels..').start()
  const todoistLabels = await todoistClient.getLabels();
  spinner.success();

  const getExistingTask = (name: string, tasks: Array<Task>): Task|null => {
    return tasks.filter(t => t.content == name)[0] || null;
  };

  const getExistingLabel = (name: string): Label|null => {
    return todoistLabels.filter(l => l.name == name)[0] || null;
  };

  const getOrCreateLabels = async (issue: Issue) => {
    const labelsRequest = await issue.labels();

    const labelsToCreate = [];

    const ids = labelsRequest.nodes.map(label => {
      const existingLabel = getExistingLabel(label.name);

      if (!existingLabel) {
        // TODO return label id
        labelsToCreate.push(label.name);
      }
      return existingLabel.id;
    });

    labelsToCreate.map(async labelName => {
      const newLabel = await todoistClient.addLabel({name: labelName});
      console.log(newLabel);
    });

    return ids;
  };

  const syncLinearIssuesWithTodoist = (issues: Array<Issue>) => {
    issues.map(async issue => {

      // const labelIds = await getOrCreateLabels(issue);

      const name = `[${issue.identifier}] ${issue.title}`;
      const existingTask = getExistingTask(name, ticketTasks);
      if (!existingTask) {

        console.log(`📝  Adding issue: ${name}`);
        const args: AddTaskArgs = {
          content: name,
          description: issue.description,
          projectId: ticketCreationProjectId,
          // labelIds: labelIds,
        };
        todoistClient.addTask(args);
      } else {

        console.log(`♻️  Updating task: ${name}`);
        const args: UpdateTaskArgs = {
          content: name,
          description: issue.description,
        };
        todoistClient.updateTask(existingTask.id, args);
      }
    });
  };

  const syncGitlabMergeRequestsWithTodoist = (gitlabHelper: GitlabHelper) => {

    const mergeRequests = gitlabHelper.mergeRequestsToReview;

    mergeRequests.map(async (mergeRequest: MergeRequest) => {

      const isApprovedByMe = gitlabHelper.isMergeRequestApprovedBy(mergeRequest, GITLAB_USERNAME);
      const name = `CR: ${mergeRequest.title}`;
      const existingTask = getExistingTask(name, codeReviewTasks);

      if (!existingTask && !isApprovedByMe) {

        console.log(`📥 Adding Code Review: ${name}`);
        const args: AddTaskArgs = {
          content: name,
          description: mergeRequest.webUrl,
          projectId: codeReviewProjectId,
        };
        todoistClient.addTask(args);

      } else if (existingTask && !isApprovedByMe) {

        console.log(`♻️  Updating task: ${name}`);
        const args: UpdateTaskArgs = {
          content: name,
          description: mergeRequest.webUrl,
        };
        todoistClient.updateTask(existingTask.id, args);

      } else {
        //TODO
        console.log(`🗑 Deleting task: ${name} (TODO)`);
      }
    });
  };

  const linearHelper = getLinearHelper();
  await linearHelper.init();

  const gitlabHelper = getGitlabHelper();
  await gitlabHelper.init();

  syncLinearIssuesWithTodoist(linearHelper.issues);
  syncGitlabMergeRequestsWithTodoist(gitlabHelper);
};
