const CHAT_URL_PATTERN = /^https:\/\/x\.com\/i\/chat\//;

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined || tab.url === undefined) return;
  if (!CHAT_URL_PATTERN.test(tab.url)) {
    void chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    void chrome.action.setTitle({
      tabId: tab.id,
      title: "Open an X chat conversation (x.com/i/chat/...) first",
    });
    setTimeout(() => {
      if (tab.id !== undefined) void chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    }, 3000);
    return;
  }
  void chrome.tabs.create({
    url: `${chrome.runtime.getURL("exporter.html")}?tabId=${tab.id}`,
    index: tab.index + 1,
    active: false,
  });
});
