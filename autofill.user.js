// ==UserScript==
// @name        WKR
// @namespace   http://github.com/sloonz
// @include     *
// @version     1.0
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// ==/UserScript==

(function() {
	var autofillerUrl = GM_getValue("url");
	var promptURL = function() {
		var url = prompt('Autofiller URL', autofillerUrl);
		if(url) {
			autofillerUrl = url;
			GM_setValue("url", autofillerUrl);
		}
	};

	GM_registerMenuCommand("Set address", promptURL);

	if(!autofillerUrl) {
		promptURL();
	}

	var autofillerUrlParsed = document.createElement("a");
	autofillerUrlParsed.href = autofillerUrl;
	var origin = autofillerUrlParsed.protocol + "//" + autofillerUrlParsed.host;

	if(!autofillerUrl || document.location.protocol + "//" + document.location.host == origin)
		return;

	var frame = document.createElement("iframe");
	var activeElement = document.activeElement;
	var handlers = {}

	handlers.onMessage = function(event) {
		if(event.origin == origin) {
			handlers[event.data.action].apply(window, event.data.arguments);
		}
		else if(event.data == "wkr_findCredentials") {
			activeElement = document.activeElement;

			var hintCreds = {};
			if(activeElement && activeElement.form) {
				hintCreds.username = null;
				hintCreds.password = null;
				for(var i = 0; i < activeElement.form.elements.length; i++) {
					var elem = activeElement.form.elements[i];
					if(!hintCreds.password && elem.type == "password") {
						hintCreds.password = elem.value;
					}
					if((!hintCreds.username && elem.type == "text") || (elem.type == "email" && elem.value)) {
						hintCreds.username = elem.value;
					}
				}
			}

			window.addEventListener("resize", function() {
				frame.style.width = window.innerWidth + "px";
				frame.style.height = window.innerHeight + "px";
			}, false);

			frame.addEventListener("load", function() {
				frame.contentWindow.postMessage({"action": "getCredentials", "arguments": [hintCreds]}, autofillerUrl);
			}, false);

			frame.src = autofillerUrl + "?" + encodeURIComponent(window.location.toString());
			frame.style.zIndex = 1000;
			frame.style.border = "none";
			frame.style.display = "block";
			frame.style.position = "fixed";
			frame.style.left = "0";
			frame.style.top = "0";
			frame.style.width = window.innerWidth + "px";
			frame.style.height = window.innerHeight + "px";

			document.body.appendChild(frame);
		}
	};

	handlers.hide = function() {
		frame.parentNode.removeChild(frame);
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
				if((el.type == "text" || el.type == "email") && user_filled == false) {
					el.value = cred.username;
					user_filled = true;
				}
			}

			if(user_filled && pwd_filled && cred.autosubmit) {
				var evt = document.createEvent("HTMLEvents");
				evt.initEvent("submit", true, true);
				form.dispatchEvent(evt);
				form.submit();
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
	window.addEventListener("keydown", function(e){
		(e.ctrlKey && e.keyCode == 88 /* DOM_VK_X */) && window.postMessage("wkr_findCredentials","*");
	},false);
})();
