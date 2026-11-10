<?php

class Services_User_Util
{
    /*
     * Password to hash. Duplicated in SpotUserUpgrader
     * but we cannot rely on this class always being available
     * already
     */
    public static function passToHash($salt, $password)
    {
        return sha1(strrev(substr($salt, 1, 3)).$password.$salt);
    }

    // passToHash

    /*
     * Creates a password hash using the current PHP default algorithm
     * (bcrypt at the moment). The salt is part of the returned string.
     */
    public static function hashPassword($password)
    {
        return password_hash($password, PASSWORD_DEFAULT);
    }

    // hashPassword

    /*
     * Is the stored hash a legacy (salted sha1) hash?
     */
    private static function isLegacyHash($storedHash)
    {
        return strlen($storedHash) == 40 && ctype_xdigit($storedHash);
    }

    /*
     * Verifies a password against a stored hash. Supports both
     * the modern password_hash() format and the legacy salted sha1.
     */
    public static function verifyPassword($salt, $password, $storedHash)
    {
        if (!is_string($storedHash) || $storedHash === '') {
            return false;
        } // if

        if (self::isLegacyHash($storedHash)) {
            return hash_equals(strtolower($storedHash), self::passToHash($salt, $password));
        } // if

        return password_verify($password, $storedHash);
    }

    // verifyPassword

    /*
     * Should this stored hash be replaced by a new one after a successful login?
     */
    public static function passwordNeedsRehash($storedHash)
    {
        return self::isLegacyHash($storedHash) || password_needs_rehash($storedHash, PASSWORD_DEFAULT);
    }

    // passwordNeedsRehash

    /*
     * Generates an unique id (hex), used for sessions, salts and the like.
     * Uses a cryptographically secure random source.
     */
    public static function generateUniqueId()
    {
        return bin2hex(random_bytes(24));
    }

    // generateUniqueId
} // class Services_User_Util
