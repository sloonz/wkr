<?php
define("KEYRING_PATH", "/var/lib/wkr");

header('Content-Type: text/plain');

class Ring {
	public $data;

	public function __construct(&$data) {
		$this->data = $data;
	}

	public function find($name) {
		$name = explode("/", $name, 2);
		if($name[0] == $this->data->name) {
			if(count($name) == 1) {
				return $this;
			} else {
				foreach($this->data->subrings as $i => $_) {
					$sr = new Ring($this->data->subrings->$i);
					$res = $sr->find($name[1]);
					if($res)
						return $res;
				}
			}
		}
		return null;
	}

	public function additem() {
		$this->data->items[] = $_GET['item'];
	}

	public function delitem() {
		$items = array();
		foreach($this->data->items as $_ => $item) {
			if($item != $_GET['item']) {
				$items[] = $item;
			}
		}
		$this->data->items = $items;
	}

	public function create() {
		$subring = $_GET['subring'];
		$parentPass = $_GET['parentPass'];
		$ringPass = $_GET['ringPass'];
		if(!$subring || !$parentPass || !$ringPass)
			die("Bad input");

		$parentKey = hash_pbkdf2("sha1", $parentPass, base64_decode($this->data->salt), 1000, 32, true);
		$salt = openssl_random_pseudo_bytes(16);
		$ringKey = hash_pbkdf2("sha1", $ringPass, $salt, 1000, 32, true);

		if(hash("sha256", $parentKey) != $this->data->signature) 
			die('Bad password');

		if(!is_array($this->data->subrings))
			$this->data->subrings = (array)$this->data->subrings;

		$this->data->subrings[$subring] = array(
			"name" => $subring,
			"items" => array(),
			"subrings" => array(),
			"signature" => hash("sha256", $ringKey),
			"salt" => base64_encode($salt)
		);

		$iv = openssl_random_pseudo_bytes(16);
		$data = json_encode(array(
			"type" => "subring",
			"name" => $subring,
			"key" => base64_encode($ringKey)
		));

		$this->data->items[] = base64_encode($iv . openssl_encrypt($data, "aes-256-cbc", $parentKey, OPENSSL_RAW_DATA, $iv));
	}
}

function additem(&$ring) {
	$ring->items[] = $_GET['item'];
}

$id = $_GET['id'];
$action = $_GET['action'];
if(!in_array($action, array('additem', 'delitem', 'get', 'newuser', 'create'))) {
	header('HTTP/1.1 400 Bad Request');
	die('GTFO');
}

if(in_array($action, array('newuser', 'create'))) {
	$id = hash("sha256", $id);
}
$filename = KEYRING_PATH . "/$id.json";

if(!file_exists($filename)) {
	if($action == "newuser") {
		$salt = openssl_random_pseudo_bytes(16);
		if(!$salt)
			die('Yuk, no salt');

		$pwd = $_GET['password'];
		if(!$pwd)
			die('No password');

		$key = hash_pbkdf2("sha1", $pwd, $salt, 1000, 32, true);
		if(!$key)
			die('No key');

		$name = $_GET['ringname'];
		$data = array(
			"salt" => base64_encode($salt),
			"signature" => hash("sha256", $key),
			"items" => array(),
			"subrings" => array(),
			"name" => $name
		);

		$data = json_encode($data);
		if($data && file_put_contents($filename, $data)) {
			die("done");
		} else {
			die("error");
		}
	} else {
		header('HTTP/1.1 404 Not Found');
		die('Invalid id');
	}
} else if($action == "newuser") {
	die('User already exists');
}

$ring = @json_decode(@file_get_contents($filename));
if(!$ring) {
	header('HTTP/1.1 404 Not Found');
	die('Not Found');
}

if($action == "get") {
	die(json_encode($ring, JSON_PRETTY_PRINT));
}

$ring = new Ring($ring);
$subring = $ring->find($_GET['ringname']);
if(!$subring) {
	header('HTTP/1.1 404 Not Found');
	die('Not Found');
}

$subring->$action();
$ring = json_encode($ring->data, JSON_PRETTY_PRINT);
if($ring) {
	if(!copy($filename, "$filename-" . time())) {
		header('HTTP/1.1 500 Internal Server Error');
		die('Oops');
	}
	if(file_put_contents($filename, $ring)) {
		echo "1";
		exit;
	}
}
header('HTTP/1.1 500 Internal Server Error');
die('Oops');
