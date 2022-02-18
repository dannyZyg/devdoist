import { GITLAB_API_KEY, GITLAB_USERNAME, GITLAB_GROUP_NAME } from '../Constants';
import { createSpinner, Spinner } from 'nanospinner'
import { MergeRequest } from 'gitlab-graphql-types';

export class GitlabHelper {

  groupName: string;
  username: string;
  spinner: Spinner;
  mergeRequestsToReview: Array<MergeRequest>

  constructor() {
    this.groupName = GITLAB_GROUP_NAME;
    this.username = GITLAB_USERNAME;
  }

  init = async () => {
    this.spinner = createSpinner('Fetching Gitlab Merge Requests...').start()
    const openMergeRequests = await this.getGitlabMergeRequestsByGroup(this.groupName);
    this.spinner.success();

    this.spinner = createSpinner('Filtering Gitlab Merge Requests requiring review from me...').start()
    this.mergeRequestsToReview = this.filterMergeRequestsByReviewerUsername(openMergeRequests, GITLAB_USERNAME);
    this.spinner.success();
  };

  getGitlabMergeRequestsByGroup = async (groupName: string) => {

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
    const mergeRequests = responseJson.data?.group?.mergeRequests?.edges ?? [];
    return mergeRequests.map(mergeRequest => mergeRequest?.node);
  };

  filterMergeRequestsByReviewerUsername = (mergeRequests: Array<MergeRequest>, username: string) => {
    return mergeRequests.filter(mergeRequest => {
      const reviewers = mergeRequest?.reviewers?.edges;
      let isReviewerMe = false;

      for (const reviewer of reviewers) {
        if (reviewer?.node?.username === username) {
          isReviewerMe = true;
        }
      }
      return isReviewerMe ? mergeRequest : null;
    });
  }

  isMergeRequestApprovedBy = (mergeRequest: MergeRequest, username: string) => {
    const approvers = mergeRequest?.approvedBy?.edges ?? [];

    for (const approver of approvers) {
      if (approver?.node?.username === username) {
        return true;
      }
    }
    return false;
  }
}

let activeGitlabHelperInstance: GitlabHelper | undefined;

export const getGitlabHelper = () => {

	if (activeGitlabHelperInstance === undefined) {
		activeGitlabHelperInstance = new GitlabHelper();
	}
	return activeGitlabHelperInstance;
};
