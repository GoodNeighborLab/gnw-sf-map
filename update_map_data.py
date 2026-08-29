import os
import json
import logging
import google.auth
from googleapiclient.discovery import build

#Ignore auth lib spam
logging.getLogger('google_auth_httplib2').setLevel(logging.ERROR)

"""
Parse single Google Sheet to single json file.
Includes stripping special characters and safe output to avoid taxing downstream JS code.
"""
def main():    
    # Automatic auth for Cloudshell + Github Actions via WIF
    credentials, project_id = google.auth.default()
    service = build('sheets', 'v4', credentials=credentials)

    # Load Sheet
    SPREADSHEET_ID = '1DOLbNJuoZUdOJixIYThu1023rJpbTDCVmNGp8ixEjeo'
    RANGE_NAME = 'GNL map data!A:Z'
    
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID, range=RANGE_NAME
    ).execute()
    
    rows = result.get('values', [])
    
    # Parse to JSON
    structured_data = []
    if len(rows) > 1:
        headers = rows[0]  # Load headers
        
        for row in rows[1:]:
            row_dict = {
                header: str(value).replace('\r\n', ' ').replace('\n', ' ').replace('\r', ' ')
                for header, value in zip(headers, row)
                }
            structured_data.append(row_dict)
            
    output_data = {"sheets_data": structured_data}
    
    # Write to ./data directory
    FILEPATH = os.path.join("data", "groups_data.json")
    with open(FILEPATH, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully processed {len(structured_data)} records into structured JSON.")

if __name__ == '__main__':
    main()
