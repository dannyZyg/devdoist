import { LINEAR_API_KEY } from '../Constants';
import { createSpinner, Spinner } from 'nanospinner'
import { LinearClient, Issue, IssueConnection, User } from '@linear/sdk';

export class LinearHelper {

  linearClient: LinearClient;
  spinner: Spinner;
  me: User;
  issues: Array<Issue> = [];

  constructor() {
    this.linearClient = new LinearClient({ apiKey: LINEAR_API_KEY })
  }

  init = async () => {
    this.spinner = createSpinner('Fetching Linear User..').start()
    this.me = await this.getMe();
    this.spinner.success();

    this.spinner = createSpinner('Fetching Linear Issues..').start()
    this.issues = await this.getAllLinearIssues();
    this.spinner.success();
  };

  getAllLinearIssues = async (): Promise<Array<Issue>> => {
    let hasMoreIssues = true;
    let issuesEndCursor = null;
    let tempIssues: Array<Issue> = [];

    while (hasMoreIssues) {
      const issueConnection: IssueConnection = await this.getLinearIssuesSet(issuesEndCursor);

      if (issueConnection.nodes.length > 0) {
        tempIssues = [...tempIssues, ...issueConnection.nodes];
      }

      issuesEndCursor = issueConnection.pageInfo.endCursor;
      hasMoreIssues = issueConnection.pageInfo.hasNextPage;
    }

    return tempIssues;
  };

  getMe = async () => {
    return await this.linearClient.viewer;
  };

  getLinearIssuesSet = async (after: string|null = null) => {
    return await this.me.assignedIssues(
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
  };
}

let activeLinearHelperInstance: LinearHelper | undefined;

export const getLinearHelper = () => {

	if (activeLinearHelperInstance === undefined) {
		activeLinearHelperInstance = new LinearHelper();
	}
	return activeLinearHelperInstance;
};
