import os
from flask import Flask, flash, request, abort, render_template, redirect, url_for
from flask_cors import CORS
import json
import requests

ALLOWED_EXTENSIONS = set(['png', 'jpg', 'jpeg', 'pdf', 'txt'])

app = Flask(__name__)
CORS(app)

@app.route("/")
def index():
	return render_template("index.html")

if __name__ == "__main__":
	app.run(host="0.0.0.0")