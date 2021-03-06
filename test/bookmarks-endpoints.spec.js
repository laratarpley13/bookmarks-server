const { expect } = require('chai')
const knex = require('knex')
const supertest = require('supertest')
const { updateBookmark } = require('../bookmarks-service')
const app = require('../src/app')
const { makeBookmarksArray } = require('./bookmarks.fixtures')

describe.only('Bookmarks Endpoints', function() {
    let db

    before('make knex instance', () => {
        db = knex({
            client: 'pg',
            connection: process.env.TEST_DB_URL,
        })
        app.set('db', db)
    })

    after('disconnect from db', () => db.destroy())

    before('clean the table', () => db('bookmarks').truncate())

    afterEach('cleanup', () => db('bookmarks').truncate())

    describe(`GET /api/bookmark`, () => {
        context(`Given no articles`, () => {
            it(`responds with 200 and an empty list`, () => {
                return supertest(app)
                    .get('/api/bookmark')
                    .expect(200, [])
            })
        })
        context('Given there are bookmarks in the database', () => {
            const testBookmarks = makeBookmarksArray()
    
            beforeEach('insert bookmarks', () => {
                return db
                    .into('bookmarks')
                    .insert(testBookmarks)
            })        
    
            it('responds with 200 and all of the bookmarks', () => {
                return supertest(app)
                    .get('/api/bookmark')
                    .expect(200, testBookmarks)
    
            })
        })
        context('Given an XSS attack bookmark', () => {
            const maliciousBookmark = {
                id: 911, 
                title: 'Naughty naughty very naughty <script>alert("xss");</script>',
                url: 'https://google.com',
                description: `Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.`,
                rating: 1    
            }

            beforeEach('insert malicious bookmark', () => {
                return db
                    .into('bookmarks')
                    .insert([ maliciousBookmark ])
            })

            it('removes XSS attack content', () => {
                return supertest(app)
                    .get(`/api/bookmark`)
                    .expect(200)
                    .expect(res => {
                        expect(res.body[0].title).to.eql('Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;')
                        expect(res.body[0].description).to.eql(`Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`)
                    })
            })
        })    
    })
    
    describe(`GET /api/bookmark/:bookmark_id`, () => {
        context(`Given there are no bookmarks in the database`, () => {
            it(`responds with 404`, () => {
                const bookmarkId = 123456
                return supertest(app)
                    .get(`/api/bookmark/${bookmarkId}`)
                    .expect(404, { error: { message: `Bookmark doesn't exist` } })
            })
        })

        context('Given there are bookmarks in the database', () => {
            const testBookmarks = makeBookmarksArray()
    
            beforeEach('insert bookmarks', () => {
                return db
                    .into('bookmarks')
                    .insert(testBookmarks)
            })        
    
            it('responds with 200 and the specified bookmark', () => {
                const bookmarkId = 2
                const expectedBookmark = testBookmarks[bookmarkId - 1]
                return supertest(app)
                    .get(`/api/bookmark/${bookmarkId}`)
                    .expect(200, expectedBookmark)    
            })
        })
        
        context('Given an XSS attack bookmark', () => {
            const maliciousBookmark = {
                id: 911, 
                title: 'Naughty naughty very naughty <script>alert("xss");</script>',
                url: 'https://google.com',
                description: `Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.`,
                rating: 1    
            }

            beforeEach('insert malicious bookmark', () => {
                return db
                    .into('bookmarks')
                    .insert([ maliciousBookmark ])
            })

            it('removes XSS attack content', () => {
                return supertest(app)
                    .get(`/api/bookmark/${maliciousBookmark.id}`)
                    .expect(200)
                    .expect(res => {
                        expect(res.body.title).to.eql('Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;')
                        expect(res.body.description).to.eql(`Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`)
                    })
            })
        })
    })
    
    describe(`POST /api/bookmark`, () => {
        it(`creates a bookmark, responding with 201 and the new bookmark`, () => {
            const newBookmark = {
                title: 'Test new bookmark',
                url: 'https://www.facebook.com/',
                description: 'Test new bookmark content...',
                rating: 2
            }
            return supertest(app)
                .post('/api/bookmark')
                .send(newBookmark)
                .expect(201)
                .expect(res => {
                    expect(res.body.title).to.eql(newBookmark.title)
                    expect(res.body.url).to.eql(newBookmark.url)
                    expect(res.body.description).to.eql(newBookmark.description)
                    expect(res.body.rating).to.eql(newBookmark.rating)
                    expect(res.body).to.have.property('id')
                    expect(res.headers.location).to.eql(`/api/bookmark/${res.body.id}`)
                })
                .then(postRes => 
                    supertest(app)
                        .get(`/api/bookmark/${postRes.body.id}`)
                        .expect(postRes.body)    
                )
        })

        it(`responds with 400 and an error message if 'title' is not supplied`, () => {
            const newBookmark = {
                //title: 'Test new bookmark',
                url: 'https://www.facebook.com/',
                description: 'Test new bookmark content...',
                rating: 1
            }

            return supertest(app)
                .post('/api/bookmark')
                .send(newBookmark)
                .expect(400, {
                    error: { message: `Missing 'title' in request body` }
                })
        })

        it(`responds with 400 and an error message if 'url' is not supplied`, () => {
            const newBookmark = {
                title: 'Test new bookmark',
                //url: 'https://www.facebook.com/',
                description: 'Test new bookmark content...',
                rating: 1
            }

            return supertest(app)
                .post('/api/bookmark')
                .send(newBookmark)
                .expect(400, {
                    error: { message: `Missing 'url' in request body` }
                })
        })

        it(`responds with 400 and an error message if 'rating' is not supplied`, () => {
            const newBookmark = {
                title: 'Test new bookmark',
                url: 'https://www.facebook.com/',
                description: 'Test new bookmark content...',
                //rating: 1
            }

            return supertest(app)
                .post('/api/bookmark')
                .send(newBookmark)
                .expect(400, {
                    error: { message: `Missing 'rating' in request body` }
                })
        })

        it(`responds with 400 and an error message when rating is not an integer between 1 and 5`, () => {
            const newBookmark = {
                title: 'Test new bookmark',
                url: 'https://www.facebook.com/',
                description: 'Test new bookmark content...',
                rating: 'invalid'
            }

            return supertest(app)
                .post('/api/bookmark')
                .send(newBookmark)
                .expect(400, {
                    error: { message: `Rating must be an integer between 1 and 5` }
                })
        })

        it(`responds with 400 and an error message when the url is not valid`, () => {
            const newBookmark = {
                title: 'Test new bookmark',
                url: 'facebook',
                description: 'Test new bookmark content...',
                rating: 2
            }

            return supertest(app)
                .post('/api/bookmark')
                .send(newBookmark)
                .expect(400, {
                    error: { message: `The url must be a valid url` }
                })
        })
        context('Given an XSS attack bookmark', () => {
            const maliciousBookmark = {
                id: 911, 
                title: 'Naughty naughty very naughty <script>alert("xss");</script>',
                url: 'https://google.com',
                description: `Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.`,
                rating: 1    
            }

            it('removes XSS attack content', () => {
                return supertest(app)
                    .post(`/api/bookmark`)
                    .send(maliciousBookmark)
                    .expect(201)
                    .expect(res => {
                        expect(res.body.title).to.eql('Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;')
                        expect(res.body.description).to.eql(`Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`)
                    })
            })
        })    
        
    })

    describe(`DELETE /api/bookmark/:id`, () => {
        context(`Given no bookmarks`, () => {
            it(`responds with 404`, () => {
                const bookmarkId = 123456
                return supertest(app)
                    .delete(`/api/bookmark/${bookmarkId}`)
                    .expect(404, { error: { message: `Bookmark doesn't exist` } })
            })
        })

        context(`Given there are bookmarks in the database`, () => {
            const testBookmarks = makeBookmarksArray()

            beforeEach('insertBookmarks', () => {
                return db
                    .into('bookmarks')
                    .insert(testBookmarks)
            })

            it(`responds with 204 and removes the article`, () => {
                const idToRemove = 2
                const expectedBookmarks = testBookmarks.filter(bookmark => bookmark.id !== idToRemove)
                return supertest(app)
                    .delete(`/api/bookmark/${idToRemove}`)
                    .expect(204)
                    .then(res => 
                        supertest(app)
                            .get('/api/bookmark')
                            .expect(expectedBookmarks)    
                    )
            })
        })
    })
    describe.only(`PATCH /api/bookmark/:bookmark_id`, () => {
        context(`Given no bookmarks`, () => {
            it(`responds with 404`, () => {
                const bookmarkId = 123456
                return supertest(app)
                    .patch(`/api/bookmark/${bookmarkId}`)
                    .expect(404, { error: { message: `Bookmark doesn't exist` } })
            })
        })
        context(`Given there are bookmarks in the database`, () => {
            const testBookmarks = makeBookmarksArray()
            
            beforeEach('insert bookmarks', () => {
                return db
                    .into('bookmarks')
                    .insert(testBookmarks)
            })

            it('responds with 204 and updates the bookmark', () => {
                const idToUpdate = 2
                const updateBookmark = {
                    title: 'Update bookmark title',
                    url: 'https//facebook.com',
                    description: 'updated bookmark description',
                    rating: 2,
                }
                const expectedBookmark = {
                    ...testBookmarks[idToUpdate - 1],
                    ...updateBookmark
                }
                return supertest(app)
                    .patch(`/api/bookmark/${idToUpdate}`)
                    .send(updateBookmark)
                    .expect(204)
                    .then(res => 
                        supertest(app)
                        .get(`/api/bookmark/${idToUpdate}`)
                        .expect(expectedBookmark)
                    )
            })

            it(`responds with 400 when no required fields are supplied`, () => {
                const idToUpdate = 2
                return supertest(app)
                    .patch(`/api/bookmark/${idToUpdate}`)
                    .send( {irrelevant: 'foo bar'} )
                    .expect(400, {
                        error: {
                            message: `Request body must contain either 'title', 'url', 'description' or 'rating'`
                        }
                    })
            })

            it(`responds with 204 and updates only a subset of the fields`, () => {
                const idToUpdate = 2
                const updateBookmark = {
                    title: 'Update bookmark title',
                    rating: 2,
                }
                const expectedBookmark = {
                    ...testBookmarks[idToUpdate - 1],
                    ...updateBookmark
                }

                return supertest(app)
                    .patch(`/api/bookmark/${idToUpdate}`)
                    .send({
                        ...updateBookmark,
                        irrelevant: 'foo bar, ignore this'
                    })
                    .expect(204)
                    .then(res => 
                        supertest(app)
                            .get(`/api/bookmark/${idToUpdate}`)
                            .expect(expectedBookmark)    
                    )
            })
        })
    })
})