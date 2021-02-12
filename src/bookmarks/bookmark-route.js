const express = require('express')
const { v4: uuid } = require('uuid')
const logger = require('../logger')
const { bookmarks } = require('../store')
const { isWebUri } = require('valid-url')
const BookmarksService = require('../../bookmarks-service')
const app = require('../app')

const bookmarkRouter = express.Router()
const bodyParser = express.json()

bookmarkRouter
    .route('/bookmark')
    .get((req, res) => {
        const knexInstance = req.app.get('db')
        BookmarksService.getAllBookmarks(knexInstance)
            .then(bookmarks => {
                res.json(bookmarks)
            })
    })
    .post(bodyParser, (req, res) => {
        const { title, url, rating, desc } = req.body;

        if (!title) {
            logger.error(`Title is required`);
            return res
                .status(400)
                .send('Invalid data');
        }
        if (!url) {
            logger.error(`URL is required`);
            return res
                .status(400)
                .send('Invalid data');
        }
        if (!rating) {
            logger.error(`Rating is required`);
            return res
                .status(400)
                .send('Invalid data');
        }
        if (!desc) {
            logger.error(`Description is required`);
            return res
                .status(400)
                .send('Invalid data');
        }

        if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
            logger.error(`Rating must be an integer between 0 and 5.`)
            return res
                .status(400)
                .send('Invalid rating')
        }

        if (!isWebUri(url)) {
            logger.error(`Invalid URL`)
            return res
                .status(400)
                .send('Invalid URL')
        }

        //get id and add bookmark
        const id = uuid();
        const bookmark = {
            id,
            title,
            url,
            rating,
            desc
        };
        bookmarks.push(bookmark);

        logger.info(`Bookmark with id ${id} created`);
        res.status(201)
            .location(`http://localhost:8000/bookmark/${id}`).json(bookmark);
    })

bookmarkRouter
    .route('/bookmark/:id')
    .get((req, res) => {
        const knexInstance = req.app.get('db')
        BookmarksService.getById(knexInstance, req.params.id)
            .then(bookmark => {
                if (!bookmark) {
                    return res.status(404).json({
                        error: { message: `Bookmark doesn't exist` }
                    })
                }
                res.json(bookmark)
            })
    })
    .delete((req, res) => {
        const { id } = req.params;
        
        const bookmarkIndex = bookmarks.findIndex(b => b.id == id);

        if (bookmarkIndex === -1) {
            logger.error(`Bookmark with id ${id} not found.`);
            return res
                .status(404)
                .send('Not found');
        }

        bookmarks.splice(bookmarkIndex, 1);
        
        logger.info(`Bookmark with id ${id} deletedd.`)
        res
            .status(204)
            .end();
    })

    module.exports = bookmarkRouter