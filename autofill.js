if(typeof String.prototype.startsWith != 'function') {
	String.prototype.startsWith = function(str) {
		return this.slice(0, str.length) == str;
	};
}

if(typeof String.prototype.endsWith != 'function') {
	String.prototype.endsWith = function(str) {
		return this.slice(-str.length) == str;
	};
}

var currentRing = null;
var parent_url = document.createElement("a");
parent_url.href = decodeURIComponent(window.location.search.slice(1));

var reply = function(fn) {
	window.parent.postMessage({"action": fn, "arguments": Array.prototype.slice.call(arguments, 1)}, parent_url);
};

var handlers = {};
var hintedCreds = null;

handlers.getCredentials = function(_hintedCreds) {
	hintedCreds = _hintedCreds;
	wkr.load();
};

$(window).bind("message", function(event) {
	if(event.originalEvent.origin != parent_url.protocol + "//" + parent_url.host) {
		alert('Parent URL and requested URL does not match');
		return;
	}

	if(handlers[event.originalEvent.data.action])
	handlers[event.originalEvent.data.action].apply(window, event.originalEvent.data.arguments);
});

wkr.selectRing = function(ring) {
	currentRing = ring;
	$("#current-ring").text(currentRing.name);
};

wkr.afterLogin = function() {
	/* If hostname = test.example.com, then search for test.example.com, then example.com */
	// TODO: what about localhost ? what about 192.168.0.1 ? what about port ?
	var items = {};
	var hintedItems = {};
	var collectItems = function(ring) {
		if(!ring.key) {
			ring.openFromParent();
		}
		ring.items.forEach(function(encodedItem) {
			var item = ring.decodeItem(encodedItem);
			var host = parent_url.host;
			while(host.indexOf(".") > 0) {
				var match = (
					(item.host && item.path) &&
					(parent_url.protocol == "https:" || !item.secure) &&
					(item.host[0] == "." ? parent_url.host.endsWith(item.host.slice(1)) : item.host == parent_url.host) &&
					(parent_url.pathname.startsWith(item.path))
					);
				if(match) {
					if(hintedCreds.username && hintedCreds.username == item.username) {
						hintedItems[ring.signature + "-" + encodedItem] = [ring.fullname, item];
					} else {
						items[ring.signature + "-" + encodedItem] = [ring.fullname, item];
					}
				}
				host = host.slice(host.indexOf(".")+1);
			}
		});
		ring.subrings.forEach(function(sr){
			collectItems(sr, host);
		});
	};

	collectItems(wkr.rootRing);

	if(Object.keys(hintedItems).length > 0) {
		items = hintedItems;
	}

	if(Object.keys(items).length == 1) {
		reply("pushCredentials", items[Object.keys(items)[0]][1]);
		reply("hide");
	} else if(Object.keys(items).length > 1) {
		$("#cred-selection-panel").show();
		for(var i in items) {
			var item_a = $('<a href="#" onclick="return false;" class="list-group-item"></a>');
			var item_h = $('<h4 class="list-group-item-heading"></h4>');
			var item_t = $('<p class="list-group-item-text"></p>');
			item_h.text(items[i][1].username);
			item_t.text(items[i][0]);
			item_a.append(item_h);
			item_a.append(item_t);
			(function(item){
				item_a.click(function(){
					reply("pushCredentials", item);
					reply("hide");
				});
			})(items[i][1]);
			$("#cred-selection").append(item_a);
		};
	} else if(confirm('No entry for this website. Do you want to create one ?')) {
		wkr.setItem({
			"host": "." + parent_url.host.replace(/^www\./, ""),
			"path": "/",
			"secure": (parent_url.protocol == "https:"),
			"username": hintedCreds.username,
			"password": hintedCreds.password
		});
		$("#panel").show();
	}
};

$(function() {
	$("#close-btn").click(function(){reply("hide");});
	$("#sign-out").click(function(){
		localStorage.removeItem("wkrCredentials");
		sessionStorage.removeItem("wkrCredentials");
		$("#auth-info").hide();
		$("#panel").hide();
		$("#auth-form").show();
	});
	$("#item-form").submit(function(){
		var item = wkr.getItem();
		wkr.submitItem(currentRing, null, function() {
			reply("pushCredentials", item);
			reply("hide");
		});
	});
});
