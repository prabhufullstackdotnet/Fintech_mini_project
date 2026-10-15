const express = require('express');
const {
  createJournalEntry,
  listJournalEntries,
  getJournalEntryById,
} = require('../controllers/journalEntriesController');

const router = express.Router();

router.post('/', createJournalEntry);
router.get('/', listJournalEntries);
router.get('/:id', getJournalEntryById);

module.exports = router;
