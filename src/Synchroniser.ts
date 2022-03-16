import { GITLAB_USERNAME } from './Environment';
import { MergeRequest } from 'gitlab-graphql-types';
import { Issue, LinearClient } from '@linear/sdk';
import {
  TodoistApi,
  AddTaskArgs,
  UpdateTaskArgs,
} from '@doist/todoist-api-typescript'
import { TodoistHelper } from './destinations/Todoist';
import { LinearHelper } from './sources/Linear';
import { GitlabHelper } from './sources/Gitlab';

interface SynchroniserConstructor {
  linearHelper: LinearHelper;
  todoistHelper: TodoistHelper;
  gitlabHelper: GitlabHelper;
}

export default class Synchroniser {

  linearHelper: LinearHelper;
  todoistHelper: TodoistHelper;
  gitlabHelper: GitlabHelper;

  linearClient: LinearClient;
  todoistClient: TodoistApi;


  constructor({linearHelper, todoistHelper, gitlabHelper}: SynchroniserConstructor) {

    this.linearHelper = linearHelper;
    this.todoistHelper = todoistHelper;
    this.gitlabHelper = gitlabHelper;

    this.linearClient = linearHelper.linearClient;
    this.todoistClient = todoistHelper.todoistClient;
  }

  beginSync = () => {

    const todoistProjects = this.todoistHelper.projects;

    const linearProjectName = this.todoistHelper.todoistLinearIssuesProjectName;
    const linearProject = this.todoistHelper.getTodoistProjectByName(linearProjectName, todoistProjects);

    if (linearProject && linearProject.id) {
      this.syncLinearIssuesWithTodoist(this.linearHelper.issues, linearProject.id);
    }

    const reviewsProjectName = this.todoistHelper.todoistCodeReviewProjectName;
    const reviewsProject = this.todoistHelper.getTodoistProjectByName(reviewsProjectName, todoistProjects);

    if (reviewsProject && reviewsProject.id) {
      this.syncGitlabOpenMergeRequestsWithTodoist(this.gitlabHelper, reviewsProject.id);
      this.syncGitlabMergedMergeRequestsWithTodoist(this.gitlabHelper);
    }
  };

  syncLinearIssuesWithTodoist = (issues: Array<Issue>, todoistProjectId: number) => {

    const todoistClient = this.todoistClient;
    const linearIssuesTasksInTodoist = this.todoistHelper.todoistTasksLinearIssues;

    issues.map(async issue => {

      // const labelIds = await getOrCreateLabels(issue);

      const name = `[${issue.identifier}] ${issue.title}`;
      const existingTask = this.todoistHelper.getExistingTask(name, linearIssuesTasksInTodoist);

      if (!existingTask) {

        console.log(`📝  Adding issue: ${name}`);
        const args: AddTaskArgs = {
          content: name,
          description: issue.description,
          projectId: todoistProjectId,
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

  syncGitlabOpenMergeRequestsWithTodoist = (gitlabHelper: GitlabHelper, todoistProjectId: number) => {

    const mergeRequests = gitlabHelper.mergeRequestsToReview;
    const todoistClient = this.todoistClient;
    const codeReviewTasksInTodoist = this.todoistHelper.todoistTasksCodeReviews;

    mergeRequests.map(async (mergeRequest: MergeRequest) => {

      const isApprovedByMe = gitlabHelper.isMergeRequestApprovedBy(mergeRequest, GITLAB_USERNAME);
      const name = `CR: ${mergeRequest.title}`;
      const existingTask = this.todoistHelper.getExistingTask(name, codeReviewTasksInTodoist);

      if (!existingTask && !isApprovedByMe) {

        console.log(`📥 Adding Code Review: ${name}`);
        const args: AddTaskArgs = {
          content: name,
          description: mergeRequest.webUrl,
          projectId: todoistProjectId,
        };
        todoistClient.addTask(args);
      } else if (existingTask && !isApprovedByMe) {

        console.log(`♻️  Updating task: ${name}`);
        const args: UpdateTaskArgs = {
          content: name,
          description: mergeRequest.webUrl,
        };
        todoistClient.updateTask(existingTask.id, args);

      } else if (existingTask && isApprovedByMe) {

        console.log(`⛳️  Marking task completed: ${name} (TODO)`);
        todoistClient.closeTask(existingTask.id);
      }
    });
  };

  syncGitlabMergedMergeRequestsWithTodoist = (gitlabHelper: GitlabHelper) => {

    const mergeRequests = gitlabHelper.mergeRequestsReviewed;
    const todoistClient = this.todoistClient;
    const codeReviewTasksInTodoist = this.todoistHelper.todoistTasksCodeReviews;

    mergeRequests.map(async (mergeRequest: MergeRequest) => {

      const name = `CR: ${mergeRequest.title}`;
      const existingTask = this.todoistHelper.getExistingTask(name, codeReviewTasksInTodoist);

      if (existingTask) {
        console.log(`⛳️  Marking task completed: ${name}`);
        todoistClient.closeTask(existingTask.id);
      }
    });
  };
}
