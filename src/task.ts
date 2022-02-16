import { LINEAR_API_KEY, TODOIST_API_KEY, GITLAB_API_KEY, GITLAB_FULL_NAME } from './constants';
import { createSpinner } from 'nanospinner'
import { LinearClient, Issue } from '@linear/sdk';
import { Project as GitlabProject, MergeRequest } from 'gitlab-graphql-types';
import {
  TodoistApi,
  Project,
  Task,
  Label,
  AddTaskArgs,
  AddLabelArgs,
  GetTasksArgs,
  UpdateTaskArgs,
} from '@doist/todoist-api-typescript'

export default async (): Promise<void> => {

  const getGitlabMergeRequests = async () => {
    const groupName = 'goodpairdays';
    const body = {
      query: `
        query allGroupMergeRequests {
          group (fullPath: "${groupName}") {
            name
            mergeRequests (state: opened, draft: false) {
              edges {
                node {
                  title
                  webUrl
                  author {
                    name
                  }
                  labels {
                    edges {
                      node {
                        title
                      }
                    }
                  }
                  project {
                    name
                  }
                  reviewers {
                    edges {
                      node {
                        name
                        username
                      }
                    }
                  }
                  approvedBy {
                    edges {
                      node {
                        name
                        username
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
    };
    const response = await fetch('https://gitlab.com/api/graphql', {
      method: 'post',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITLAB_API_KEY}`,
      }
    });
    const responseJson = await response.json();
    const mergeRequests = responseJson.data?.group?.mergeRequests?.edges;
    return mergeRequests.map(mergeRequest => mergeRequest?.node);
  };


  const filterMergeRequestsByName = (mergeRequests, name: string) => {
    return mergeRequests.filter(mergeRequest => {
      const reviewers = mergeRequest?.reviewers?.edges;
      let isReviewerMe = false;

      for (const reviewer of reviewers) {
        if (reviewer?.node?.name === name) {
          isReviewerMe = true;
        }
      }
      return isReviewerMe ? mergeRequest : null;
    });
  }

  const isMergeRequestApprovedBy = (mergeRequest, name: string) => {
    const approvers = mergeRequest?.approvedBy?.edges ?? [];

    for (const approver of approvers) {
      if (approver?.node?.name === name) {
        return true;
      }
    }
    return false;
  }

  const getLinearIssues = async (after: string|null = null) => {

    spinner = createSpinner('Fetching Linear Issues..').start()
    const issues = await me.assignedIssues(
      {
        first: 50,
        after: after,
        filter: {
          state: {
            name: {
              in: ["In Progress", "Next", "Backlog"],
            },
          },
        },
      },
    );

    spinner.success()
    return issues;
  };


  const linearClient = new LinearClient({ apiKey: LINEAR_API_KEY })
  const todoistClient = new TodoistApi(TODOIST_API_KEY);

  let spinner = createSpinner('Fetching Todoist Projects..').start()
  const todoistProjects = await todoistClient.getProjects();
  spinner.success();

  // const ticketCreationFilter: Array<Project> = todoistProjects.filter(p => p.name == "Ticket Creation");
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

  spinner = createSpinner('Fetching Linear User..').start()
  const me = await linearClient.viewer;
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

  const syncGitlabMergeRequestsWithTodoist = (mergeRequests: Array<MergeRequest>) => {
    mergeRequests.map(async (mergeRequest: MergeRequest) => {

      const isApprovedByMe = isMergeRequestApprovedBy(mergeRequest, GITLAB_FULL_NAME);
      const name = `CR: ${mergeRequest.title}`;
      const existingTask = getExistingTask(name, codeReviewTasks);

      if (!existingTask && !isApprovedByMe) {

        console.log(`📥  Adding Code Review: ${name}`);
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

  spinner = createSpinner('Fetching Gitlab Merge Requests...').start()
  const openMergeRequests = await getGitlabMergeRequests();
  const myPendingCodeReviews = filterMergeRequestsByName(openMergeRequests, GITLAB_FULL_NAME);
  spinner.success();

  let hasMoreIssues = true;
  let issuesEndCursor = null;

  while (hasMoreIssues) {
    const linearIssues = await getLinearIssues(issuesEndCursor);

    issuesEndCursor = linearIssues.pageInfo.endCursor;
    hasMoreIssues = linearIssues.pageInfo.hasNextPage;

    if (linearIssues.nodes.length > 0) {
      syncLinearIssuesWithTodoist(linearIssues.nodes);
    }
  }

  syncGitlabMergeRequestsWithTodoist(myPendingCodeReviews);
};
