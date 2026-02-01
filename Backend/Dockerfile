# 1. Use Python 3.9
FROM python:3.9

# 2. Set working directory
WORKDIR /code

# 3. Install dependencies
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

#Required for sentiment
RUN python -m textblob.download_corpora

# 4. Copy the application code
COPY . .

# 5. Permission Fix (Keep this, it's excellent for Hugging Face)
RUN mkdir -p /code/cache && chmod -R 777 /code/cache
ENV HF_HOME=/code/cache

# 6. Start Server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]