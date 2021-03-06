# Depreciation Notice

This project has been created when the offer for open-source and
self-hosted passwords manager was poor. This is no longer the case,
and there are better solutions out there. I am no longer maintaining
this repository.

[Bitwarden](https://bitwarden.com/) is an excellent
open-source alternative, with a great self-hosted option with
[bitwarden\_rs](https://github.com/dani-garcia/bitwarden_rs).

# What is it

Like LastPass, it is a password manager. Differences with LastPass are :

* Open-source and self-hosted

* Not a browser extension but a GreaseMonkey script (for portability)

* Hierarchical. That means that a ring can contains another ring, and
that the sub-ring can be open either with its own password, or with its
parent ring

# Installation and usage

Server-side : copy all files on your web server (PHP is required). Modify
the first line of `keyring.php` and point to a directory writable by PHP.

The main entry point is `admin.htm`. First, install user script. The
script will ask you the autofiller url ; it is the URL for
`autofill.htm`. You can then create an account.

Usage : press C-y in any authentication form. The first time it will ask
you to create an entry ; next time it will automatically fill the form.

You can use `admin.htm` to manage rings and entries.

# Google Chrome/Chromium notes

You must use the Tampermonkey extension to use the user-script.

# TODO

Contributions welcome, especially on UI side.

* Bookmarklets, OTP
