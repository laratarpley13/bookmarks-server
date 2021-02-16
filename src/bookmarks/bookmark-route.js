const express = require('express')
const xss = require('xss')
const { v4: uuid } = require('uuid')
const logger = require('../logger')
const { isWebUri } = require('valid-url')
const BookmarksService = require('../../bookmarks-service')

const bookmarkRouter = express.Router()
const bodyParser = express.json()

const serializeBookmark = bookmark => ({
    id: bookmark.id,
    title: xss(bookmark.title),
    url: xss(bookmark.url),
    description: xss(bookmark.description),
    rating: bookmark.rating
})

bookmarkRouter
    .route('/bookmark')
    .get((req, res, next) => {
        const knexInstance = req.app.get('db')
        BookmarksService.getAllBookmarks(knexInstance)
            .then(bookmarks => {
                res.json(bookmarks.map(serializeBookmark))
            })
            .catch(next)
    })
    .post(bodyParser, (req, res, next) => {
        const { title, url, rating, description } = req.body;

        if(!title) {
            return res.status(400).json({
                error: { message: `Missing 'title' in request body` }
            })
        }

        if(!url) {
            return res.status(400).json({
                error: { message: `Missing 'url' in request body` }
            })
        }

        if(!rating) {
            return res.status(400).json({
                error: { message: `Missing 'rating' in request body` }
            })
        }

        const ratingNum = Number(rating)

        if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            logger.error(`Rating must be an integer between 1 and 5.`)
            return res
                .status(400).json({
                    error: { message: `Rating must be an integer between 1 and 5` }
                })
        }

        if (!isWebUri(url)) {
            logger.error(`Invalid URL`)
            return res
                .status(400).json({
                    error: { message: `The url must be a valid url` }
                })
        }

        const newBookmark = { title, url, rating, description };

        BookmarksService.insertBookmark(
            req.app.get('db'),
            newBookmark
        )
            .then(bookmark => {
                res
                    .status(201)
                    .location(`/bookmark/${bookmark.id}`)
                    .json(serializeBookmark(bookmark))
            })
            .catch(next)
    })

bookmarkRouter
    .route('/bookmark/:bookmark_id')
    .all((req, res, next) => {
        BookmarksService.getById(
            req.app.get('db'),
            req.params.bookmark_id
        )
            .then(bookmark => {
                if(!bookmark) {
                    return res.status(404).json({
                        error: { message: `Bookmark doesn't exist` }
                    })
                }
                res.bookmark = bookmark
                next()
            })
            .catch(next)
    })
    .get((req, res, next) => {
        res.json({
            id: res.bookmark.id,
            title: xss(res.bookmark.title),
            url: xss(res.bookmark.url),
            description: xss(res.bookmark.description),
            rating: res.bookmark.rating,
        })
    })
    .delete((req, res, next) => {
        BookmarksService.deleteBookmark(
            req.app.get('db'),
            req.params.bookmark_id
        )
            .then(() => {
                res.status(204).end()
            })
            .catch(next)
    })

    module.exports = bookmarkRouter