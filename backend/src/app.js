const express = require('express');
const documentRoutes = require('./routes/documentRoutes');
const ownerContext = require('./middleware/ownerContext');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(ownerContext);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(documentRoutes);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
