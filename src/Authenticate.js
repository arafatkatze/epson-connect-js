// Authenticate.js

const axios = require('axios');
const moment = require('moment');

/**
 * Represents the Authentication Context to interact with the API.
 */
class AuthContext {
  
  /**
   * Create an AuthContext instance.
   * @param {string} baseUrl - Base URL of the API.
   * @param {string} printerEmail - Email of the printer.
   * @param {string} clientId - Client ID for API access.
   * @param {string} clientSecret - Client Secret for API access.
   */
  constructor(baseUrl, printerEmail, clientId, clientSecret) {
    this.baseUrl = baseUrl;
    this.printerEmail = printerEmail;
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    this.expiresAt = moment();
    this.accessToken = '';
    this.refreshToken = '';
    this.subjectId = '';
  }

  /**
   * Initializes the authentication context.
   * @private
   */
  async _initialize() {
    await this._auth();
  }

  /**
   * Handles the authentication process.
   * @private
   * @throws {AuthenticationError} Throws an error if authentication fails.
   */
  async _auth() {
    const method = 'POST';
    const path = '/api/1/printing/oauth2/auth/token?subject=printer';

    if (this.expiresAt.isAfter(moment())) {
      return;
    }

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const auth = {
      username: this.clientId,
      password: this.clientSecret
    };

    let data;

    if (this.accessToken === '') {
      data = {
        grant_type: 'password',
        username: this.printerEmail,
        password: '',
      };
    } else {
      data = {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      };
    }

    try {
      const body = await this.send(method, path, data, headers, auth);

      const error = body.error;

      if (error) {
        throw new AuthenticationError(error);
      }

      // First time authenticating, set refresh_token
      if (this.accessToken === '') {
        this.refreshToken = body.refresh_token;
      }

      this.expiresAt = moment().add(body.expires_in, 'seconds');
      this.accessToken = body.access_token;
      this.subjectId = body.subject_id;

    } catch (e) {
      throw new AuthenticationError(e);
    }
  }

  /**
   * Handles the deauthentication process.
   * @private
   */
  async _deauthenticate() {
    const method = 'DELETE';
    const path = `/api/1/printing/printers/${this.subjectId}`;
    await this.send(method, path);
  }

  /**
   * Sends requests to the API.
   * @param {string} method - HTTP method to be used.
   * @param {string} path - Endpoint path.
   * @param {Object} [data=null] - Data payload.
   * @param {Object} [headers=null] - Request headers.
   * @param {Object} [auth=null] - Authentication credentials.
   * @returns {Promise<Object>} Returns the server's response.
   * @throws {ApiError} Throws an error for unsuccessful requests.
   */
  async send(method, path, data = null, headers = null, auth = null) {
    if (!auth) {
      this._auth();
    }
  
    headers = headers || this.defaultHeaders;
    const request = {
      method: method,
      url: this.baseUrl + path,
      headers: headers,
      data: data,
      auth: auth,
    };
  
    try {
      const resp = await axios(request);
      let respData = resp.data;
  
      if (resp.headers && resp.headers['content-type'] && resp.headers['content-type'].indexOf('application/json') === -1) {
        respData = { code: resp.data.toString() };
      }
  
      if (!resp) {
        throw new ApiError('No response received from server');
      } 
  
      if (respData && respData.code) {
        throw new ApiError(respData.code);
      }
  
      if (!respData || Object.keys(respData).length === 0) {
        return { message: 'Request was successful, but no data was returned.' };
      } 
  
      return respData;
  
    } catch (error) {
      // Re-throw the error to be handled in higher scopes
      throw error;
    }
  }

  /**
   * @property {Object} defaultHeaders - The default headers for API requests.
   */
  get defaultHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * @property {string} deviceId - The subject ID associated with the device.
   */
  get deviceId() {
    return this.subjectId;
  }
}

/**
 * Custom error class for Authentication-related issues.
 */
class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Custom error class for API-related issues.
 */
class ApiError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApiError";
  }
}

module.exports = { AuthContext, AuthenticationError, ApiError };
