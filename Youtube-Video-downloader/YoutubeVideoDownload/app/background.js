var mp3list = [];
chrome.downloads.onChanged.addListener(function (download) {
	if (download.state) {
		if (download.state.current === 'complete') {
			for (var i = 0; i < mp3list.length; i++) {
				if (mp3list[i] === download.id) {
					chrome.downloads.erase({
						id: mp3list[i]
					});
					mp3list.splice(i, 1);
					break;
				}
			}
		}
	}
});

chrome.runtime.onMessage.addListener(
	function (request) {
		if (localStorage.location === undefined && localStorage.location !== '') {
			chrome.downloads.showDefaultFolder();
			var loc = prompt('Please enter a storage location relative to your download location, the default location is the folder that just opened', '');
			loc = loc.replace(/\\/g, '\\\\');
			localStorage.setItem('location', loc);
		}

		mp3list.push(request.data);

		request.title = request.title
			.replace(/&amp;/g, '&')
			.replace('[//\\]/g', '-')
			.replace(/[*:|]/g, '')
			.replace(/["<>]/g, '\'');

		console.log(request.data);
		chrome.downloads.download({
			url: request.data,
			filename: localStorage.location + request.title + '.mp3'
		}, function (downloadItem) {
			mp3list.push(downloadItem);
		});

	}
);

