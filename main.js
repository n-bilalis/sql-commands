//
// Configuration (do not edit here)
//

const port = 3000,
	express = require("express"),
	httpStatus = require("http-status-codes"),
	app = express();

const path = require("path");

const sqlite3 = require("sqlite3").verbose();

// articles.db is the advanced database
let db = new sqlite3.Database('articles.db', (err) => {
	if (err) {
		return console.error(err.message);
	}
	console.log('Connected to sqlite db');
});

// Server configuration
app.set("view engine", "ejs");
// views is the folder for the templates in the advanced version
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
// middleware configuration
app.use(express.urlencoded({ extended: false }));

app.listen(port, () => {
	console.log(`The Express.js server has started and is listening
		on port number: ${port}`);
});

app.get("/", (req, res) => {
	res.render("index");
});

app.get("/about", (req, res) => {
	res.render("about");
});

//
// List items
//

app.get("/articles", (req, res) => {
	// write an SQL command that joins the tables Journal, Issue, Article, Article_Author and Author, sort the list
	// the following fields are required: article id and title, journal title, issue number and author name
	// disambiguation is needed
	const sql = `
		SELECT Article.a_id, Article.title AS a_title, Journal.title AS j_title, Issue.number, GROUP_CONCAT(Author.name, '; ') AS name
		FROM Article
		INNER JOIN Issue ON Article.i_id = Issue.i_id
		INNER JOIN Journal ON Issue.j_id = Journal.j_id
		INNER JOIN Article_Author ON Article.a_id = Article_Author.a_id
		INNER JOIN Author ON Article_Author.au_id = Author.au_id
		GROUP BY Article.a_id, Article.title, Journal.title, Issue.number
		ORDER BY Journal.title, Issue.number`;
	db.all(sql, [], (err, rows) => {
		if (err) {
			return console.error(err.message);
		}
		//console.log(rows);
		res.render("articles", { model: rows });
	});
});

app.get("/authors", (req, res) => {
	// write an SQL command that selects au_id and name for all authors, sort the list
	const sql = "SELECT au_id, name FROM Author ORDER BY name";
	db.all(sql, [], (err, rows) => {
		if (err) {
			return console.error(err.message);
		}
		//console.log(rows);
		res.render("authors", { model: rows });
	});
});

app.get("/journals", (req, res) => {
	// write an SQL command that selects j_id and title for all journals, sort the list
	const sql = "SELECT j_id, title FROM Journal ORDER BY title";
	db.all(sql, [], (err, rows) => {
		if (err) {
			return console.error(err.message);
		}
		//console.log(rows);
		res.render("journals", { model: rows });
	});
});

app.get("/issues", (req, res) => {
	// write an SQL command that joins Issue with Journal, sort the list
	// issue id and number, and journal title are required
	const sql = `
		SELECT Issue.i_id, Issue.number, Journal.title
		FROM Issue
		INNER JOIN Journal ON Issue.j_id = Journal.j_id
		ORDER BY Journal.title, Issue.number`;
	db.all(sql, [], (err, rows) => {
		if (err) {
			return console.error(err.message);
		}
		//console.log(rows);
		res.render("issues", { model: rows });
	});
});

// Search articles
app.get("/search_articles/", (req, res) => {
	q = req.query.q;
	// write an SQL command that joins the tables Journal, Issue, Article and Author, sort the list
	// some kind of search functionality should be build in, where q is the search query
	// the following fields are required: article id and title, journal title, issue number and author name
	// disambiguation is needed
	const sql = `
		SELECT Article.a_id, Article.title AS a_title, Journal.title AS j_title, Issue.number, GROUP_CONCAT(Author.name, '; ') AS name
		FROM Article
		INNER JOIN Issue ON Article.i_id = Issue.i_id
		INNER JOIN Journal ON Issue.j_id = Journal.j_id
		INNER JOIN Article_Author ON Article.a_id = Article_Author.a_id
		INNER JOIN Author ON Article_Author.au_id = Author.au_id
		WHERE Article.title LIKE ? OR Journal.title LIKE ? OR Issue.number LIKE ? OR Author.name LIKE ?
		GROUP BY Article.a_id, Article.title, Journal.title, Issue.number
		ORDER BY Journal.title, Issue.number`;
	const param = `%${q.trim()}%`;
	db.all(sql, [param, param, param, param], (err, rows) => {
		if (err) {
			return console.error(err.message);
		}
		//console.log(rows);
		res.render("articles", { model: rows });
	});
});

//
// Insert items
//

app.get("/create_journal", (req, res) => {
	res.render("create_journal");
});

app.post("/create_journal", (req, res) => {
	// create an insert SQL command to add a journal title
	const sql = "INSERT INTO Journal (title) VALUES (?)";
	// pick up the relevant field(s) from req.body
	const journal = [req.body.Title];
	db.run(sql, journal, err => {
		if (err) {
			console.log(err);
		}
		res.redirect("/journals");
	});
});

app.get("/create_author", (req, res) => {
	res.render("create_author");
});

app.post("/create_author", (req, res) => {
	// create an insert SQL command to add an author name
	const sql = "INSERT INTO Author (name) VALUES (?)";
	// pick up the relevant field(s) from req.body
	const author = [req.body.Name];
	db.run(sql, author, err => {
		if (err) {
			console.log(err);
		}
		res.redirect("/authors");
	});
});

app.get("/create_issue", (req, res) => {
	// we need a list of journals to create an issue
	let rows_j;
	// write an SQL command that selects journal id and title for all journals, sort the list
	const sql_j = "SELECT j_id, title FROM Journal ORDER BY title";
	dbquery(sql_j, db).then( rows => {
		rows_j = rows;
	}, err => {
		return dbclose(db).then( () => { throw err; } )
	} )
	.then( () => {
		res.render("create_issue", { journalmodel: rows_j });
	} )
	.catch( err => {
		// handle the error
		console.log(err);
	} );
});

app.post("/create_issue", (req, res) => {
	// create an insert SQL command to add a journal id and issue number to Issue
	const sql = "INSERT INTO Issue (j_id, number) VALUES (?, ?)";
	// pick up the relevant field(s) from req.body (the order must be the same as in the query)
	const issue = [req.body.Journal, req.body.Number];
	db.run(sql, issue, err => {
		if (err) {
			console.log(err);
		}
		res.redirect("/issues");
	});
});

app.get("/create_article", (req, res) => {
	let rows_au, rows_i;
	// create an SQL command that selects author id and name for all authors, sort the list
	const sql_au = "SELECT au_id, name FROM Author ORDER BY name";
	// create an SQL command that joins Issue with Journal, sort the list
	// required fields are issue id and number, and journal title
	const sql_i = `
		SELECT Issue.i_id, Issue.number, Journal.title
		FROM Issue
		INNER JOIN Journal ON Issue.j_id = Journal.j_id
		ORDER BY Journal.title, Issue.number`;
	dbquery(sql_au, db).then( rows => {
		rows_au = rows;
		return dbquery(sql_i, db);
	} )
	.then( rows => {
		rows_i = rows;
	}, err => {
		return dbclose(db).then( () => { throw err; } )
	} )
	.then( () => {
		res.render("create_article", { authormodel: rows_au, issuemodel: rows_i });
	} )
	.catch( err => {
		// handle the error
		console.log(err);
	} );
});

app.post("/create_article", (req, res) => {
	// create an insert SQL command to add an issue id and a title to Article
	const sql = "INSERT INTO Article (i_id, title) VALUES (?, ?)";
	// pick up the relevant field(s) from req.body (the order must be the same as in the array)
	const article = [req.body.Issue, req.body.Title];
	const au_list = [req.body.Author, req.body.SecondAuthor, req.body.ThirdAuthor];
	db.run(sql, article, err => {
		if (err) {
			console.log(err);
		}
		// the following instructions will connect all authors to the article
		// pick up the a_id of the inserted article
		const sql = "SELECT a_id FROM Article ORDER BY a_id DESC LIMIT 1 OFFSET 0";
		db.get(sql, (err, row) => {
			if (err) {
				console.log(err);
			}
			last_a_id = row.a_id;
			// connect the authors to the article
			for (au in au_list) {
				if (au_list[au] != "") {
					au_id = au_list[au];
					db.run("INSERT INTO Article_Author(a_id, au_id) VALUES(?, ?)", [last_a_id, au_id], function(err) {
						if (err) {
							return console.log(err.message);
						}
					});
				}
			}
		});
		res.redirect("/articles");
	});
});

//
// Update
//

// Title only
app.get("/edit_article_basic/:id", (req, res) => {
	// write an SQL command that selects id, title, issue id for the article with the given id
	const sql = "SELECT a_id, title, i_id FROM Article WHERE a_id = ?";
	// pick up article id from the URL (req.params.id)
	const id = req.params.id;
	db.get(sql, id, (err, row) => {
		if (err) {
			console.log(err);
		}
		res.render("edit_article_basic", { model: row });
	});
});

app.post("/edit_article_basic/:id", (req, res) => {
	// write an SQL command that updates the article with the given id (the order must be the same as in the array)
	const sql = "UPDATE Article SET title = ? WHERE a_id = ?"
	// pick up article id from the URL (req.params.id)
	const id = req.params.id;
	// pick up the relevant field(s) from req.body and add id
	const article = [req.body.Title, id];
	db.run(sql, article, err => {
		if (err) {
			console.log(err);
		}
		res.redirect("/articles");
	});

});

app.get("/edit_author/:id", (req, res) => {
	const sql = "SELECT au_id, name FROM Author WHERE au_id = ?";
	const id = req.params.id;
	db.get(sql, id, (err, row) => {
		if (err) {
			console.log(err);
		}
		res.render("edit_author", { model: row });
	});
});

app.post("/edit_author/:id", (req, res) => {
	const sql = "UPDATE Author SET name = ? WHERE au_id = ?"
	const id = req.params.id;
	const author = [req.body.Name, id];
	db.run(sql, author, err => {
		if (err) {
			console.log(err);
		}
		res.redirect("/authors");
	});
});

app.get("/edit_journal/:id", (req, res) => {
	const sql = "SELECT j_id, title FROM Journal WHERE j_id = ?";
	const id = req.params.id;
	db.get(sql, id, (err, row) => {
		if (err) {
			console.log(err);
		}
		res.render("edit_journal", { model: row });
	});
});

app.post("/edit_journal/:id", (req, res) => {
	const sql = "UPDATE Journal SET title = ? WHERE j_id = ?"
	const id = req.params.id;
	const journal = [req.body.Title, id];
	db.run(sql, journal, err => {
		if (err) {
			console.log(err);
		}
		res.redirect("/journals");
	});
});

//
// Delete an article
//

app.get("/delete_article/:id", (req, res) => {
	// write an SQL command that selects id, title for the article with the given id
	const sql = "SELECT a_id, title FROM Article WHERE a_id = ?";
	// pick up article id from the URL (req.params.id)
	const id = req.params.id;
	db.get(sql, id, (err, row) => {
		if (err) {
			console.log(err);
		}
		res.render("delete_article", { model: row });
	});
});

app.post("/delete_article/:id", (req, res) => {
	// write an SQL command that deletes the article with the given id
	const sql = "DELETE FROM Article WHERE a_id = ?";
	// pick up article id from the URL (req.params.id)
	const id = req.params.id;
	db.run(sql, id, (err) => {
		if (err) {
			console.log(err);
		}
		// write an SQL command that deletes the corresponding rows in the Article_Author link table
		db.run("DELETE FROM Article_Author WHERE a_id = ?", id, (err) => {
			if (err) {
				console.log(err);
			}
		});
		res.redirect("/articles");
	});
});

//
// Help functions to work with database synchronously (do not edit these)
//

function dbquery(sql, db, args) {
	return new Promise((resolve, reject) => {
		db.all(sql, args, (err, rows) => {
			if (err)
				return reject(err);
			resolve(rows);
		});
	});
}

function dbquery_one(sql, db, args) {
	return new Promise((resolve, reject) => {
		db.get(sql, args, (err, rows) => {
			if (err)
				return reject(err);
			resolve(rows);
		});
	});
}

function dbquery_run(sql, db, args) {
	return new Promise((resolve, reject) => {
		db.run(sql, args, (err, rows) => {
			if (err)
				return reject(err);
			resolve(rows);
		});
	});
}

function dbclose(db) {
	return new Promise((resolve, reject) => {
		db.close(err => {
			if (err) {
				return reject(err);
			}
			resolve();
		});
	});
}
