# Use a lightweight Python image
FROM python:3.11-slim

# Set working directory in container
WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (documentation purposes, Render will use PORT env variable)
EXPOSE 5000

# Set environment variable for Flask
ENV FLASK_APP=app.py

# Run the application with gunicorn
# Gunicorn will listen on the PORT environment variable (set by Render) or default to 5000
CMD exec gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 60 app:app
