import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from groq import Groq
import re

def truncate_to_word_count_sentence(text, target_count):
    if not isinstance(text, str):
        return text
        
    # Split text while strictly preserving all whitespace (including newlines)
    tokens = re.split(r'(\s+)', text.strip())
    
    final_text = ""
    word_count = 0
    
    for i, token in enumerate(tokens):
        final_text += token
        if not token.isspace():
            word_count += 1
            
        if word_count >= target_count:
            # Check if this token ends with sentence-ending punctuation (., !, ?)
            if re.search(r'[.!?]+[^\w\s]*$', token):
                # Peek ahead to see if the immediate next token is an emoji (to avoid cutting off an emoji that belongs to the sentence)
                j = i + 1
                while j < len(tokens):
                    if tokens[j].isspace() and '\n' not in tokens[j]:
                        j += 1
                        continue
                    if not re.search(r'[a-zA-Z0-9]', tokens[j]) and '\n' not in tokens[j]:
                        for k in range(i + 1, j + 1):
                            final_text += tokens[k]
                    break
                break
            
    return final_text.strip()

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app)

# Initialize Groq client
# The API key is automatically picked up from the GROQ_API_KEY environment variable
client = Groq()

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/generate', methods=['POST'])
def generate_post():
    data = request.json
    
    title = data.get('title', '')
    organization = data.get('organization', '')
    duration = data.get('duration', '')
    skills = data.get('skills', '')
    bullets = data.get('bullets', '')
    wordCount = data.get('wordCount', '150')
    
    if not all([title, organization, duration, skills, bullets]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        target_count_int = int(wordCount)
    except ValueError:
        target_count_int = 150

    prompt = f"""
    You are an expert LinkedIn ghostwriter. A user wants to create a LinkedIn post about their experience.
    
    Here is the user's information:
    - Role/Title: {title}
    - Organization: {organization}
    - Duration: {duration}
    - Skills Learned: {skills}
    - Key Bullet Points (what they did):
    {bullets}
    
    Please write 3 different versions of the LinkedIn post in the following tones. 
    
    You MUST adhere to this exact predefined structure for the content of every post:
    
    1. Hook (First 1-2 lines): Grab attention immediately. (e.g., Excited to share that I have successfully completed my [Title] at [Organization]!)
    
    2. What You Did: Briefly explain your experience and what you worked on using the provided bullets. (e.g., During this internship, I gained hands-on exposure to: ...)
    
    3. Key Learnings: Mention skills and knowledge acquired. Use checkmarks (✅) or similar bullet points. (e.g., Key skills and concepts I developed: ✅ Skill 1 ✅ Skill 2)
    
    4. Gratitude: Thank the organization and mentors. (e.g., I sincerely thank the team at [Organization] for providing an enriching learning environment...)
    
    5. Looking Ahead: Show enthusiasm for future opportunities. (e.g., This experience has strengthened my interest in these technologies, and I look forward to applying these learnings...)
    
    CRITICAL INSTRUCTIONS for formatting the text:
    - Write in short, highly readable lines (1-2 sentences max per paragraph).
    - EXTREMELY IMPORTANT: You must use a VERY HIGH amount of emojis!
    - Every single bullet point or listed item MUST start with a highly relevant emoji (e.g., 📡 Telecom Networks, 🔒 Cyber Security, 💻 Programming).
    - Insert relevant emojis directly next to important words inside the sentences (e.g., "excited 🎉", "learning 📚", "future 🚀", "team 🤝").
    - Leave proper spacing (a blank line) between every section.
    - Include a strong Call to Action (CTA) or thought-provoking question at the end.
    - DO NOT include the section labels or numbers (like "1. Hook:", "What You Did:", "Key Learnings:", etc.) in the text. Just write the paragraphs directly so it forms a seamless, ready-to-copy LinkedIn post.
    
    IMPORTANT: You must write a detailed post for EACH version. Please write at least {target_count_int + 40} words for each version to ensure there is enough content to cover all the sections above.
    
    1. Professional: Formal, highlighting achievements and career growth.
    2. Casual: Friendly, conversational, and easy-going.
    3. Excited: Highly enthusiastic, using emojis, expressing extreme gratitude.
    
    Also, provide a string of 4-6 recommended hashtags.
    
    IMPORTANT: You must return the output EXACTLY in the following JSON format. 
    The value for each tone MUST be a single, continuous string. Use "\\n\\n" to create paragraph breaks between the different sections (Hook, Body, Takeaways, etc.).
    CRITICAL: Do NOT use nested JSON objects for the sections. Just return one long string per tone.
    {{
        "professional": "The hook... \\n\\nThe context... \\n\\nThe body... \\n\\nTakeaways... \\n\\nClosing...",
        "casual": "The casual tone post...",
        "excited": "The excited tone post...",
        "hashtags": "#Hashtag1 #Hashtag2"
    }}
    """
    
    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that only outputs valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1500,
            response_format={"type": "json_object"}
        )
        
        # Parse the JSON response
        response_text = completion.choices[0].message.content
        result_json = json.loads(response_text)
        
        # Enforce sentence-aware word count limit programmatically
        for tone in ['professional', 'casual', 'excited']:
            if tone in result_json:
                content = result_json[tone]
                # Normalize if the LLM creatively returned an object instead of string
                if isinstance(content, dict):
                    if 'text' in content:
                        content = content['text']
                    elif 'content' in content:
                        content = content['content']
                    else:
                        # Join all string values if the LLM returned sections as dictionary keys
                        content = "\n\n".join(str(v) for v in content.values() if isinstance(v, str))
                
                # Truncate content to the nearest complete sentence that hits the word count
                result_json[tone] = truncate_to_word_count_sentence(content, target_count_int)
        
        return jsonify(result_json)
        
    except Exception as e:
        print(f"Error generating post: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
