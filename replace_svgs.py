

import os
import re
import urllib.request
import glob

# --- Configuration ---
PROJECT_ROOT = "D:\\WORKDATA\\clip-js"
SEARCH_PATTERN = os.path.join(PROJECT_ROOT, "app", "**", "*.tsx")
SVG_SAVE_DIR = os.path.join(PROJECT_ROOT, "public", "icons")

# --- Main Logic ---
def find_svg_urls_in_files():
    """Finds all unique SVG repo URLs in the specified files."""
    urls = set()
    file_paths = glob.glob(SEARCH_PATTERN, recursive=True)
    print(f"Found {len(file_paths)} files to search.")
    for file_path in file_paths:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                found_urls = re.findall(r'https://www.svgrepo.com/show/[a-zA-Z0-9_./-]+\.svg', content)
                if found_urls:
                    urls.update(found_urls)
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    print(f"Found {len(urls)} unique SVG URLs.")
    return list(urls)

def download_and_save_svgs(urls):
    """Downloads SVGs from URLs and saves them locally."""
    if not os.path.exists(SVG_SAVE_DIR):
        os.makedirs(SVG_SAVE_DIR)
        print(f"Created directory: {SVG_SAVE_DIR}")

    url_map = {}
    for url in urls:
        try:
            filename = os.path.basename(url)
            save_path = os.path.join(SVG_SAVE_DIR, filename)
            
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            
            with urllib.request.urlopen(req) as response, open(save_path, 'wb') as out_file:
                svg_content = response.read()
                out_file.write(svg_content)
            
            print(f"Successfully downloaded and saved {filename}")
            url_map[url] = f"/icons/{filename}"
        except Exception as e:
            print(f"Failed to download {url}: {e}")
    return url_map

def replace_urls_in_files(url_map):
    """Replaces remote SVG URLs with local paths in project files."""
    file_paths = glob.glob(SEARCH_PATTERN, recursive=True)
    total_modified_files = 0
    for file_path in file_paths:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            modified_content = original_content
            file_was_modified = False
            for old_url, new_path in url_map.items():
                if old_url in modified_content:
                    modified_content = modified_content.replace(old_url, new_path)
                    file_was_modified = True

            if file_was_modified:
                print(f"Updating paths in {os.path.basename(file_path)}...")
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(modified_content)
                total_modified_files += 1

        except Exception as e:
            print(f"Error processing {file_path}: {e}")
    print(f"\nFinished! {total_modified_files} files were modified.")

if __name__ == "__main__":
    print("--- Starting SVG Link Replacement Script ---")
    svg_urls = find_svg_urls_in_files()
    if svg_urls:
        url_to_local_path_map = download_and_save_svgs(svg_urls)
        if url_to_local_path_map:
            replace_urls_in_files(url_to_local_path_map)
    print("--- Script finished ---")
