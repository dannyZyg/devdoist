# devdoist

Synchronises various dev tools with [Todoist](todoist.com/).

## Why?

I get tired of looking in multiple places to know what needs to be done. Email
notifications from these tools are useful, but sometimes they get lost in the
sea of mail in your inbox and you just need the important details.

##### By keeping these tasks in Todoist you can:

- Avoid checking email for updates, or worse, using your email as a TODO list.
- At a glance, easily see merge requests waiting for your review, across multiple repos.
- Split up your development tasks from Linear into subtasks with your own personal notes, all under 1 parent task.
- Use Todist calendar notation to schedule time for tasks on google calendar `wed 9am [30m]`
- Tick things off and manage your time in one place.

## API Keys

You'll need the following API Keys:

- `LINEAR_API_KEY`
- `GITLAB_API_KEY`
- `TODOIST_API_KEY`

## Overview

Currently, this tool provides somewhat hardcoded functionality with some custom environment variables set in `.env`:

#### Sync Gitlab merge requests to a specified Todoist project as tasks

	- Uses the group name from `GITLAB_GROUP_NAME`
	- Uses the user name from `GITLAB_USERNAME`
	- Looks for merge requests with your gitlab username which are not yet approved by you
	- Updates existing tasks or creates new tasks

#### Sync Linear issues to a specified Todoist project as tasks

	- Automatically identifies the user through the API key and gets issues assigned to you
	- Creates tasks for Issues with status of "In Progress", "Next" or "Backlog"
	- Updates existing tasks or creates new tasks

#### Customise the Todoist destination projects

- `TODOIST_LINEAR_ISSUES_PROJECT_NAME`: The project name where you want development tasks to go
- `TODOIST_CODE_REVIEW_PROJECT_NAME`: The project name where you want pending code reviews to go

## Supported Sources

- [Gitlab](https://about.gitlab.com/)
- [Linear](https://linear.app/)

## Supported Destinations

- [Todoist](https://todoist.com/)

## Future plans

- Support OAuth
- Provide a configuration file in yml or json to customise the sync
- Add more sources as I go
