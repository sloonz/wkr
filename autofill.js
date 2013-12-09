// ==UserScript==
// @name        WKR
// @namespace   http://github.com/sloonz
// @updateURL   https://raw.github.com/sloonz/wkr/autofill.js
// @include     *
// @version     1.0
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==

(function() {
	var URL = GM_getValue("url");
	if(!URL) {
		URL = prompt('Autofiller URL');
		GM_setValue("url", URL);
	}

	var URL_a = document.createElement("a");
	URL_a.href = URL;
	ORIGIN = URL_a.protocol + "//" + URL_a.host;

	if(!URL || document.location.protocol + "//" + document.location.host == ORIGIN)
		return;

	var activeElement = document.activeElement;
	var frame = document.createElement("iframe");

	frame.addEventListener("load", function() {
		frame.contentWindow.postMessage({"action": "getCredentials", "arguments": []}, URL);
	}, false);

	var handlers = {}

	handlers.onMessage = function(event) {
		if(event.origin == ORIGIN) {
			handlers[event.data.action].apply(window, event.data.arguments);
		}
		else if(event.data == "wkr_findCredentials") {
			frame.src = URL + "?" + encodeURIComponent(window.location.toString());
			frame.style.zIndex = 1000;
			frame.style.position = "fixed";
			frame.style.display = "none";
			frame.style.border = "none";

			document.body.appendChild(frame);
		}
	};

	handlers.show = function() {
		frame.style.display = "block";
		frame.style.width = Math.floor(window.innerWidth*0.9) + "px";
		frame.style.height = Math.floor(window.innerHeight*0.9) + "px";
		frame.style.left = Math.floor(window.innerWidth*0.05) + "px";
		frame.style.top = Math.floor(window.innerHeight*0.05) + "px";
	};

	handlers.hide = function() {
		frame.parentNode.removeChild(frame);
		window.removeEventListener("message", handlers.onMessage, false);
	};

	handlers.pushCredentials = function(cred) {
		var fillForm = function(form) {
			var user_filled = false;
			var pwd_filled = false;
			for(var i in form.elements) {
				var el = form.elements[i];
				if(el.type == "password") {
					el.value = cred.password;
					pwd_filled = true;
				}
				if(el.type == "text" && user_filled == false) {
					el.value = cred.username;
					user_filled = true;
				}
			}

			if(user_filled && pwd_filled && cred.autosubmit) {
				var evt = document.createEvent("HTMLEvents");
				evt.initEvent("submit", true, true);
				form.dispatchEvent(evt);
				return true;
			}

			return false;
		};

		if(activeElement && activeElement.form) {
			if(fillForm(activeElement.form)) {
				return;
			}
		}

		var els = document.getElementsByTagName("input");
		for(var i in els) {
			if(els[i].type == "password")
				if(fillForm(els[i].form))
					return;
		}
	};

	window.addEventListener("message", handlers.onMessage, false);
	window.addEventListener("keypress", function(e){
		(e.ctrlKey && e.charCode == "x".charCodeAt(0)) && window.postMessage("wkr_findCredentials","*");
	},false);
})();
