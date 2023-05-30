(function () {
	function waitForElement(selector, callback) {
		var el;
		if ((el = document.querySelector(selector))) {
			callback(el);
		} else {
			window.setTimeout(() => {
				waitForElement(selector, callback);
			}, 50);
		}
	}

	function increaseHeight(element) {
		element.style.height = (~~element.style.height.split('px')[0] + 33) + 'px';
	}

	if (document.URL.search('youtube.com/watch') > -1) {
		function openWindow() {
			const newwindow = window.open(`http://ytmp3.cc/#v${
				document.URL.split('watch?v=')[1]
			}`);
			newwindow.focus();
		}

		waitForElement('#contextmenu', (contextmenu) => {
			const contextMenuContainer = $('.ytp-contextmenu')[0];
			$('<div class=\'ytp-menuitem\' aria-haspopup=\'false\' tabindex=\'38\' role=\'menuitem\' href=\'#\'>' +
					'<div class=\'ytp-menuitem-label\'>Download MP3</div>' +
					'<div class=\'ytp-menuitem-content\'></div>' +
					'</div>')
				.click(openWindow)
				.insertBefore($(contextmenu).children()[2]);
			const child = contextMenuContainer.children[0];
			increaseHeight(contextMenuContainer);
			increaseHeight(child);
			increaseHeight(child.children[0]);
		});

		window.setTimeout(() => {
			waitForElement('#movie_player', (moviePlayer) => {
				moviePlayer.onkeypress = (e) => {
					if (e.which === 100) {
						//Pressed D
						openWindow();
					}
				}
			});
		}, 2500);
	} else if (document.URL.search('ytmp3.cc') > -1) {
		//Check if there's even a video in the url
		const vidId = location.href.split('#v')[1];
		if (vidId && vidId.length > 0) {
			$('#input').val(`http://www.youtube.com/watch?v=${vidId}`);
			setTimeout(function() {
				$('#submit').click();
			}, 500);
			var timer = window.setInterval(function() {
				if ($('#file').attr('href')) {
					chrome.runtime.sendMessage({
						data: $('#file').attr('href'),
						title: document.getElementById('title').innerText
					});
					//window.close();
					window.clearInterval(timer);
				}
			}, 150);
		}
	} else if (document.URL.search('youtube.com/results') > -1) {

		var justdownloaded = false;

		const $ytLockupThumbnail = $('.yt-lockup-thumbnail').mouseenter(function() {
			$(this).children('.download-mp3-button').show();
		}).mouseleave(function() {
			$(this).children('.download-mp3-button').hide();
		});
		var $buttonContent;
		const $buttonCont = $('<button class="yt-uix-button yt-uix-button-size-small yt-uix-button-default yt-uix-button-empty yt-uix-button-has-icon no-icon-markup video-actions spf-nolink yt-uix-tooltip download-mp3-button hide-until-delayloaded" type="button" onclick=";return false;" title="Download MP3 DA" role="button" data-video-ids="lgbW6IuwcZQ" data-tooltip-text="Download MP3"></button>')
			.css({
				marginRight: '24px',
				padding: 0,
				width: '22px',
				height: '22px'
			})
			.click(function() {
				$buttonContent.css('background',
					'no-repeat url(//s.ytimg.com/yts/imgbin/www-hitchhiker-vfl8VEEGb.webp) -51px -725px');
				$(this).css('background-color', 'green');
				var _this = $(this);
				justdownloaded = true;
				setTimeout(function() {
					justdownloaded = false;
					_this.css('background-color', 'rgb(248,248,248)');
					$buttonContent.css('background',
						'no-repeat url(//s.ytimg.com/yts/imgbin/www-hitchhiker-vfl8VEEGb.webp) -1px -700px');
				}, 5000);

				const newwindow = window.open(`http://www.youtube-mp3.org/#v${$(this)
					.parent().parent().children('.yt-lockup-thumbnail').children('a')
					.attr('href').split('watch?v=')[1]}`);
				newwindow.focus();
			})
			.hide()
			.appendTo($ytLockupThumbnail);

		$buttonContent = $('<div></div>')
			.css({
				background:
					'no-repeat url(//s.ytimg.com/yts/imgbin/www-hitchhiker-vfl8VEEGb.webp) -1px -700px',
				backgroundSize: 'auto',
				width: '15px',
				height: '15px',
				display: 'inline-block',
				marginTop: '3px'
			})
			.mouseenter(function() {
				$(this).css('background',
					'no-repeat url(//s.ytimg.com/yts/imgbin/www-hitchhiker-vfl8VEEGb.webp) -1px -724px');
			}).mouseleave(function() {
				if (!justdownloaded) {
					$(this).css('background',
						'no-repeat url(//s.ytimg.com/yts/imgbin/www-hitchhiker-vfl8VEEGb.webp) -1px -700px');
				}
			})
			.appendTo($buttonCont);
	}
}());