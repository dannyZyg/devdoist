import { LINEAR_API_KEY } from '../constants';
import { createSpinner, Spinner } from 'nanospinner'
import { LinearClient, Issue, IssueConnection, User } from '@linear/sdk';

class LinearHelper {

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

    let hasMoreIssues = true;
    let issuesEndCursor = null;

    while (hasMoreIssues) {
      const issueConnection: IssueConnection = await this.getLinearIssues(issuesEndCursor);

      if (issueConnection.nodes.length > 0) {
        this.issues = [...this.issues, ...issueConnection.nodes];
      }

      issuesEndCursor = issueConnection.pageInfo.endCursor;
      hasMoreIssues = issueConnection.pageInfo.hasNextPage;
    }
  };

  getMe = async () => {
    return await this.linearClient.viewer;
  };

  getLinearIssues = async (after: string|null = null) => {

    this.spinner = createSpinner('Fetching Linear Issues..').start()
    const issues = await this.me.assignedIssues(
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

    this.spinner.success()
    return issues;
  };
}

let activeLinearHelperInstance: LinearHelper | undefined;

export const getLinearHelper = () => {

	if (activeLinearHelperInstance === undefined) {
		activeLinearHelperInstance = new LinearHelper();
	}
	return activeLinearHelperInstance;
};
