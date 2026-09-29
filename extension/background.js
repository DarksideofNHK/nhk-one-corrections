// ツールバーのボタン（または Alt+Shift+T）で、ブックマークレットと同じ処理をいまのタブで動かす。
// 権限は activeTab だけなので、ボタンを押したタブの中でしか動かない。
chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !/^https:\/\/www\.web\.nhk\//.test(tab.url || '')) {
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#586271' });
    await chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
    await chrome.action.setTitle({ tabId: tab.id, title: 'NHK ONE（www.web.nhk）のページで押してください' });
    return;
  }
  await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  await chrome.action.setTitle({ tabId: tab.id, title: 'NHK ONE 訂正一覧' });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['nhk-one-corrections.js'],
    world: 'MAIN',
  });
});
