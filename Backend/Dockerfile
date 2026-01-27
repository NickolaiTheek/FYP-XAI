# 1. Use Python 3.9 as the base image
FROM python:3.9

# 2. Set the working directory inside the container
WORKDIR /code

# 3. Copy requirements and install them (This caches the installation)
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# 4. Copy the rest of your application code
COPY . .

# 5. Permission Fix: Create a cache folder that Hugging Face can write to
# (Hugging Face runs as user 1000, not root)
RUN mkdir -p /code/cache && chmod -R 777 /code/cache
ENV HF_HOME=/code/cache

# 6. Start the FastAPI server on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
