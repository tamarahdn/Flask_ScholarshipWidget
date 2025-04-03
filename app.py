import os
import requests
from dotenv import load_dotenv
from flask import Flask, render_template
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

# Flask app setup
app = Flask(__name__)

# Notion API credentials
NOTION_API_TOKEN = os.getenv('NOTION_API_TOKEN')
NOTION_DATABASE_ID = os.getenv('NOTION_DATABASE_ID')

# Notion API endpoint and headers
NOTION_API_URL = f'https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}/query'
headers = {
    'Authorization': f'Bearer {NOTION_API_TOKEN}',
    'Notion-Version': '2022-06-28'
}

# Jinja filter to safely format event dates
@app.template_filter('datetimeformat')
def datetimeformat(value):
    try:
        if isinstance(value, str):
            value = datetime.strptime(value, '%Y-%m-%d')
        return value.strftime('%d %b')
    except Exception as e:
        print(f"[datetimeformat error] {e}")
        return ''
        
# Fetch events from Notion database
def fetch_notion_data():
    response = requests.post(NOTION_API_URL, headers=headers)
    if response.status_code == 200:
        data = response.json()
        events = []
        for result in data.get('results', []):
            title = result['properties'].get('Title', {}).get('title', [{}])[0].get('text', {}).get('content', '')
            date = result['properties'].get('Date', {}).get('date', {}).get('start', '')
            tags = [tag['name'] for tag in result['properties'].get('Tags', {}).get('multi_select', [])]
            if title and date:
                events.append({'title': title, 'date': date, 'tags': tags})
        return events
    else:
        print(f"[Notion API error] Status code: {response.status_code}")
        return []

# Calculate days remaining until an event
def calculate_days_remaining(event_date):
    try:
        today = datetime.today()
        event_dt = datetime.strptime(event_date, '%Y-%m-%d')
        return (event_dt - today).days
    except Exception as e:
        print(f"[Date parsing error in calculate_days_remaining] {e}")
        return None

# Check if an event occurs in the current month
def is_event_this_month(event_date):
    try:
        today = datetime.today()
        event_dt = datetime.strptime(event_date, '%Y-%m-%d')
        return event_dt.month == today.month and event_dt.year == today.year
    except Exception as e:
        print(f"[Date parsing error in is_event_this_month] {e}")
        return False

# Home route
@app.route('/')
def index():
    try:
        events = fetch_notion_data()

        # Filter for current month's events
        events_this_month = [event for event in events if is_event_this_month(event['date'])]

        # Find closest upcoming event
        closest_event = None
        for event in events_this_month:
            days_remaining = calculate_days_remaining(event['date'])
            if days_remaining is not None and days_remaining >= 0:
                closest_event = event
                closest_event['days_remaining'] = days_remaining
                if days_remaining <= 7:
                    closest_event['theme'] = 'urgent'
                elif days_remaining <= 14:
                    closest_event['theme'] = 'warning'
                else:
                    closest_event['theme'] = 'default'
                break

        # Group events by tags
        grouped_events = {}
        for event in events_this_month:
            for tag in event['tags']:
                grouped_events.setdefault(tag, []).append(event)

        # Format current date
        current_date = datetime.today().strftime('%a, %d %b %Y')  # e.g., Mon, 31 Mar 2025

        return render_template(
            'index.html',
            current_date=current_date,
            closest_event=closest_event,
            grouped_events=grouped_events
        )

    except Exception as error:
        return f"An error occurred: {error}"

# Route to show events by tag
@app.route('/tag/<tag>')
def show_events_by_tag(tag):
    try:
        events = fetch_notion_data()
        filtered_events = [event for event in events if tag in event['tags']]
        filtered_events = sorted(filtered_events, key=lambda x: x['date'])
        return render_template('events_by_tag.html', tag=tag, events=filtered_events)
    except Exception as error:
        return f"An error occurred: {error}"
    
# Route to see all tags
@app.route('/all-tags')
def show_all_tags():
    try:
        events = fetch_notion_data()

        # Collect all unique tags
        unique_tags = set()
        for event in events:
            unique_tags.update(event['tags'])

        sorted_tags = sorted(unique_tags)  # optional: sort alphabetically

        return render_template('all_tags.html', all_tags=sorted_tags)
    except Exception as e:
        return f"An error occurred: {e}"


# Run the app
if __name__ == '__main__':
    app.run(debug=True)
