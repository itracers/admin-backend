function isAuthorizedEmail(email) {
  const adminEmails = process.env.ADMIN_EMAIL
    ? process.env.ADMIN_EMAIL.split(",")
    : [];
  return Boolean(adminEmails.find((item) => item === email?.toLowerCase()));
}

module.exports = { isAuthorizedEmail };
