// ==UserScript==
// @name        WKR
// @namespace   http://github.com/sloonz
// @include     *
// @version     1.2
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// ==/UserScript==

(function() {
	var promptURL = function() {
		var url = prompt('Autofiller URL', GM_getValue("url"));
		if(url) {
			GM_setValue("url", url);
		}
		return url;
	};

	var getAutofiller = function(ask) {
		var autofillerUrl = GM_getValue("url");
		if(!autofillerUrl && ask)
			autofillerUrl = promptURL();

		var autofillerUrlParsed = document.createElement("a");
		autofillerUrlParsed.href = autofillerUrl;
		var origin = autofillerUrlParsed.protocol + "//" + autofillerUrlParsed.host;

		if(!autofillerUrl || document.location.protocol + "//" + document.location.host == origin)
			return null;
		else
			return {"url": autofillerUrl, "origin": origin};
	};

	GM_registerMenuCommand("Set address", promptURL);

	var frame = document.createElement("iframe");
	var activeElement = document.activeElement;
	var handlers = {}

	handlers.onMessage = function(event) {
		var autofiller = getAutofiller();
		if(autofiller && autofiller.origin && event.origin == autofiller.origin) {
			handlers[event.data.action].apply(window, event.data.arguments);
		}
		else if(event.data == "wkr_findCredentials") {
			if(!autofiller)
				autofiller = getAutofiller(true);
			if(!autofiller)
				return;

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
				frame.contentWindow.postMessage({"action": "getCredentials", "arguments": [hintCreds]}, autofiller.url);
			}, false);

			frame.src = autofiller.url + "?" + encodeURIComponent(window.location.toString());
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
				if((el.type == "text" || el.type == "email" || el.type == "tel") && user_filled == false) {
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
		(e.ctrlKey && !e.shiftKey && !e.altKey && e.keyCode == 89 /* DOM_VK_Y */) && window.postMessage("wkr_findCredentials","*");
	},false);
})();
