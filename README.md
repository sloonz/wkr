# What is it

Like LastPass, it is a password manager. Differences with LastPass are :

* Open-source and self-hosted

* Not a browser extension but a GreaseMonkey script (for portability)

* Hierarchical. That means that a ring can contains another ring, and
that the sub-ring can be open either with its own password, or with its
parent ring

# Installation and usage

Server-side : copy `autofill.htm`, `keyring.js`, `keyring.php`
and `forge.min.js` on your server (PHP required with OpenSSL
extension). Modify the first line of `keyring.php` and point to a
directory writable by PHP.

You then have to create your master keyring for an user :
`https://example.com/wkr/keyring.php?action=newuser&id=username&ringname=master&password=1234`

To create a subring (in this example,
master/perso/web, where master/perso password is 123) :
`https://example.com/wkr/keyring.php?action=create&id=username&ringname=master/perso&subring=web&parentPass=123&ringPass=12`

You can then install `autofill.js` as a GreaseMonkey/UserScript script. It
will ask for WKR URL ; fill in the full URL of `autofill.htm` (in our
example, `https://example.com/wkr/autofill.htm`). It is strongly advised
to use HTTPS ; WKR won’t work on HTTPS sites otherwise.

# TODO

Contributions welcome, especially on UI side.

* Handle multiple identities for a single website

* Nice interface to manage rings and websites

* Bookmarklets, OTP

* Nice interface for user creation
