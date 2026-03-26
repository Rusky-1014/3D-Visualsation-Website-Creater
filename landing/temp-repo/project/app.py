from flask import Flask, render_template, request, redirect, url_for, session
from werkzeug.utils import secure_filename
import os
import json

app = Flask(__name__)
app.secret_key = "supersecretkey"

UPLOAD_FOLDER = 'static/models'
DATA_FILE = 'products.json'

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Create products.json if not exists
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump([], f)


def load_products():
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except:
        return []


def save_products(products):
    with open(DATA_FILE, 'w') as f:
        json.dump(products, f)


# ---------------- HOME ----------------

@app.route('/')
def home():
    return render_template('home.html')


# ---------------- ROLE ----------------

@app.route('/set_role/<role>')
def set_role(role):
    if role == "user":
        session['role'] = 'user'
        return redirect(url_for('products'))

    if role == "admin":
        return redirect(url_for('login'))

    return redirect(url_for('home'))


# ---------------- LOGIN ----------------

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if username == "admin" and password == "admin123":
            session['role'] = 'admin'
            return redirect(url_for('products'))
        else:
            return "Invalid admin credentials"

    return render_template('login.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))


# ---------------- PRODUCTS ----------------

@app.route('/products')
def products():
    if not session.get('role'):
        return redirect(url_for('home'))

    product_list = load_products()
    return render_template(
        'index.html',
        products=product_list,
        role=session.get('role')
    )


# ---------------- UPLOAD ----------------

@app.route('/upload', methods=['GET', 'POST'])
def upload():
    if not session.get('role'):
        return redirect(url_for('home'))

    if request.method == 'POST':
        name = request.form['name']
        description = request.form['description']
        file = request.files['model']

        if file and file.filename.lower().endswith('.glb'):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)

            products = load_products()

            new_product = {
                'id': len(products) + 1,
                'name': name,
                'description': description,
                'model': filename
            }

            products.append(new_product)
            save_products(products)

            return redirect(url_for('products'))

    return render_template('upload.html')


# ---------------- VIEWER ----------------

@app.route('/viewer/<model>')
def viewer(model):

    # If apple model → open apple page
    if model.lower() == "apple_vision_pro.glb":
        return render_template('apple.html')

    # Otherwise open normal viewer
    return render_template('viewer.html', model=model)


# ---------------- RUN ----------------

if __name__ == '__main__':
    app.run(debug=True)
