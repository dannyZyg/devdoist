import { getTodoistHelper } from './destinations/Todoist';
import { getLinearHelper } from './sources/Linear';
import { getGitlabHelper } from './sources/Gitlab';
import Synchroniser from './Synchroniser';

export default async (): Promise<void> => {

  const todoistHelper = getTodoistHelper();
  await todoistHelper.init();

  const linearHelper = getLinearHelper();
  await linearHelper.init();

  const gitlabHelper = getGitlabHelper();
  await gitlabHelper.init();

  const synchroniser = new Synchroniser({
    todoistHelper: todoistHelper,
    gitlabHelper: gitlabHelper,
    linearHelper: linearHelper,
  });

  synchroniser.beginSync();
};
