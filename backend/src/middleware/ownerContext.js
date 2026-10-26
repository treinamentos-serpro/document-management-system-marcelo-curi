const ownerId = process.env.DOCUMENT_OWNER_ID || 'default';

function ownerContext(req, res, next) {
  req.ownerId = ownerId;
  next();
}

module.exports = ownerContext;
