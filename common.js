wkr = {};
wkr.keyringCred = sessionStorage.getItem("wkrCredentials") || localStorage.getItem("wkrCredentials");
wkr.keyringCred = wkr.keyringCred && JSON.parse(wkr.keyringCred);
wkr.rootRing = null;

wkr.load = function() {
	$('a[href="#"]').attr("onclick", "return false;");
	$("form").attr("onsubmit", "return false;");

	$("#auth-form").submit(function(){
		var auth = wkr.getAuthForm();
		if(auth) {
			wkr.keyringCred = { id: Ring.Utils.sha256(auth.login) };
			wkr.doLogin(null, auth.password, auth.rememberType);
		}
	});

	$("textarea").keyup(function(){
		var data = $(this).val();
		if(data) {
			try {
				JSON.parse(data);
			}
			catch(e) {
				$(this).parent().addClass("has-error");
				$("#toggle-raw").attr('disabled','disabled');
				$("#save").attr('disabled','disabled');
				$("#form-error").text(e);
				return;
			}
		}

		$(this).parent().removeClass("has-error");
		$("#toggle-raw").removeAttr('disabled');
		$("#save").removeAttr('disabled');
		$("#form-error").text("");
	});

	$("#toggle-raw").click(function(){
		if($(".raw").css("display") == "none") {
			$(".raw").show();
			$(".non-raw").hide();
			$("#toggle-raw").removeClass("btn-default");
			$("#toggle-raw").addClass("btn-success");

			$("#raw-data").val(JSON.stringify(wkr.getItem()));
		} else {
			$(".raw").hide();
			$(".non-raw").show();
			$("#toggle-raw").addClass("btn-default");
			$("#toggle-raw").removeClass("btn-success");

			var data = $("#raw-data").val();
			if(data) {
				wkr.setItem(JSON.parse(data));
			}
		}
	});

	$("#toggle-viewpass").click(function(){
		var new_type = ($("#password").attr("type") == "password" ? "text" : "password");
		$("#password").attr("type", new_type);
		$("#toggle-viewpass").removeClass("glyphicon-eye-open");
		$("#toggle-viewpass").removeClass("glyphicon-eye-close");
		$("#toggle-viewpass").addClass((new_type == "password") ? "glyphicon-eye-open" : "glyphicon-eye-close");
		$("#password").focus();
	});

	$("#toggle-extra").click(function(){
		if($("#extra").css("display") == "none") {
			$("#extra").css("display", "inline");
			$("#extra").focus();
			$("#toggle-extra .glyphicon").removeClass("glyphicon-chevron-right");
			$("#toggle-extra .glyphicon").addClass("glyphicon-chevron-down");
		} else {
			$("#extra").hide();
			$("#toggle-extra .glyphicon").addClass("glyphicon-chevron-right");
			$("#toggle-extra .glyphicon").removeClass("glyphicon-chevron-down");
		}
	});

	if(wkr.keyringCred && wkr.keyringCred.id && wkr.keyringCred.key) {
		wkr.doLogin(forge.util.decode64(wkr.keyringCred.key), null, "none");
	}
};

wkr.ajax = function(data, callback) {
	if(data.action) {
		data = [data];
	}
	$("#loader-overlay").show();
	return $.ajax("keyring.php?username="+wkr.keyringCred.id, {
		dataType: "json",
		   type: "POST",
		   contentType: "application/json",
		   processData: false,
		   data: JSON.stringify(data)
	}).
	fail(function(req, err, errstr) { alert("Error : " + (errstr || err + ": " + req.responseText)); }).
		done(callback).
		always(function(){ $("#loader-overlay").hide(); })
};

wkr.submitItem = function(ring, otherAction, cb) {
	if(!$("#toggle-raw").hasClass("btn-default")) {
		var data = $("#raw-data").val();
		if(data) {
			wkr.setItem(JSON.parse(data));
		}
	}

	var data = [];
	var item = ring.encodeItem(wkr.getItem());
	if(otherAction) {
		data.push(otherAction);
	}
	data.push({action: "add-item", signature: ring.ring.signature, data: item});
	wkr.ajax(data, function(resp) {
		if(resp.result == "error") {
			alert("Unknown error: "+ resp.error);
		} else {
			ring.ring.items.push(item);
			if(cb) {
				cb();
			}
			$("#panel").hide();
		}
	});
};

wkr.doLogin = function(key, password, rememberType) {
	wkr.ajax({"action":"get"}, function(resp){
		if(resp.result == "error") {
			if(resp.error == "bad_username" || resp.error == "not_found") {
				wkr.keyringCred = null;
			} else {
				alert("Error: " + resp.error);
			}
		} else {
			wkr.rootRing = new Ring(resp.ring);
			if(key) {
				wkr.rootRing = wkr.rootRing.openWithKey(key, true);
			} else {
				wkr.rootRing = wkr.rootRing.openWithPassword(password, true);
			}

			if(wkr.rootRing) {
				$(".ring").remove();
				wkr.fillRings(wkr.rootRing, 0);
				wkr.selectRing(wkr.rootRing);
				$("#auth-form").hide();
				$("#auth-info").show();
				$("#auth-info p").text(wkr.rootRing.name + " @ " + wkr.keyringCred.id);
				if(rememberType != "none") {
					wkr.keyringCred.key = forge.util.encode64(wkr.rootRing.key);
					eval(rememberType+"Storage").setItem("wkrCredentials", JSON.stringify(wkr.keyringCred));
				}
				wkr.afterLogin();
			} else {
				wkr.keyringCred = null;
			}
		}
	});
};

wkr.fillRings = function(ring, indent) {
	var id = "r-" + ring.ring.signature;
	$("#ring-list .divider").before('<li class="ring" id="'+id+'"><a href="#"><span style="margin-left:'+indent+'em;">&nbsp;</span></a></li>');
	$("#"+id+" a").append(ring.name);
	$("#"+id+" a").attr("onclick","return false;");
	$("#"+id).click(function(){wkr.selectRing(ring);});
	ring.subrings.forEach(function(sr){
		wkr.fillRings(sr, indent+1);
	});
};

wkr.getItem = function() {
	var item = {};

	(["username", "password", "host", "path"]).forEach(function(k) {
		var v = $("#" + k).val();
		if(v)
		item[k] = v;
	});

	if(Object.keys(item).length > 0) {
		// Only fill secure and autosubmit if any other field exists
		(["autosubmit", "secure"]).forEach(function(k){
			item[k] = $("#"+k)[0].checked;
		});
	}

	var extra = $("#extra").val();
	if(extra) {
		extra = JSON.parse(extra);
		for(var k in extra) {
			item[k] = extra[k];
		}
	}

	return item;
};

wkr.setItem = function(item) {
	var remaining_item = {};

	for(var k in item) {
		switch(k) {
			case "username":
			case "password":
			case "host":
			case "path":
				$("#" + k).val(item[k]);
				break;
			case "secure":
			case "autosubmit":
				$("#" + k)[0].checked = !!item[k];
				break;
			default:
				remaining_item[k] = item[k];
		};
	}

	if(Object.keys(remaining_item).length > 0) {
		$("#extra").val(JSON.stringify(remaining_item));
	}
};

wkr.getAuthForm = function() {
	if(!$("#auth-login").val()) {
		$("#auth-login").parent().addClass("has-error");
		alert('Please enter your login');
		return;
	}
	if(!$("#auth-password").val()) {
		$("#auth-password").parent().addClass("has-error");
		alert('Please enter your password');
		return;
	}
	$("#auth-login").parent().removeClass("has-error");
	$("#auth-password").parent().removeClass("has-error");

	return {login: $("#auth-login").val(),
		password: $("#auth-password").val(),
		rememberType: $("#auth-remember :selected")[0].value};
};
