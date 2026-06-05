#!/usr/bin/env python3

import requests
import sys
import json
import os
import argparse
from datetime import datetime
import time

class WordUpAPITester:
    def __init__(self, base_url=None):
        base_url = base_url or os.getenv('WORDUP_BASE_URL', 'http://localhost:8000')
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    self.log(f"   Error: {error_detail}")
                except:
                    self.log(f"   Response: {response.text}")
                
                self.failed_tests.append({
                    'test': name,
                    'endpoint': endpoint,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'error': response.text[:200]
                })
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Exception: {str(e)}")
            self.failed_tests.append({
                'test': name,
                'endpoint': endpoint,
                'expected': expected_status,
                'actual': 'Exception',
                'error': str(e)
            })
            return False, {}

    def test_auth_flow(self):
        """Test authentication endpoints"""
        self.log("\n=== TESTING AUTHENTICATION ===")
        
        # Test user registration - Creative user
        test_email = f"test_writer_{int(time.time())}@example.com"
        success, response = self.run_test(
            "Register Creative User",
            "POST",
            "auth/register",
            200,
            data={
                "email": test_email,
                "password": "TestPass123!",
                "name": "Test Writer",
                "user_type": "creative",
                "location": "New York, USA"
            }
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_data = response['user']
            self.log(f"   Registered user: {self.user_data['name']} ({self.user_data['user_type']})")
        
        # Test login
        success, response = self.run_test(
            "Login User",
            "POST",
            "auth/login",
            200,
            data={
                "email": test_email,
                "password": "TestPass123!"
            }
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.log(f"   Login successful, token received")
        
        # Test get current user
        self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        return success

    def test_writer_endpoints(self):
        """Test writer-specific endpoints"""
        if not self.user_data or self.user_data.get('user_type') != 'creative':
            self.log("⚠️  Skipping writer tests - not a creative user")
            return
            
        self.log("\n=== TESTING WRITER ENDPOINTS ===")
        
        # Test get writer profile
        success, profile = self.run_test(
            "Get Writer Profile",
            "GET",
            "writers/profile",
            200
        )
        
        # Test update writer profile
        self.run_test(
            "Update Writer Profile",
            "PUT",
            "writers/profile",
            200,
            data={
                "bio": "I am a passionate writer with experience in fiction and screenwriting.",
                "genres": ["Fiction", "Screenplay"],
                "experience_level": "intermediate",
                "location": "Los Angeles, CA",
                "languages": ["English", "Spanish"]
            }
        )
        
        # Test create writing sample
        sample_data = {
            "title": "The Last Sunset",
            "content": "The sun dipped below the horizon, painting the sky in shades of orange and pink. Maria stood at the edge of the cliff, watching the last light of day fade into darkness. This was it - the moment she had been waiting for her entire life.",
            "genre": "Fiction",
            "format": "short_story"
        }
        
        success, sample_response = self.run_test(
            "Create Writing Sample",
            "POST",
            "writers/samples",
            201,
            data=sample_data
        )
        
        sample_id = None
        if success and 'id' in sample_response:
            sample_id = sample_response['id']
        
        # Test get writing samples
        self.run_test(
            "Get Writing Samples",
            "GET",
            "writers/samples",
            200
        )
        
        # Test delete writing sample
        if sample_id:
            self.run_test(
                "Delete Writing Sample",
                "DELETE",
                f"writers/samples/{sample_id}",
                200
            )

    def test_ai_endpoints(self):
        """Test AI assistance endpoints"""
        if not self.user_data or self.user_data.get('user_type') != 'creative':
            self.log("⚠️  Skipping AI tests - not a creative user")
            return
            
        self.log("\n=== TESTING AI ENDPOINTS ===")
        
        # AI endpoint is currently disabled in backend/server.py and should return 501.
        # If re-enabled later, update expected status codes and assertions accordingly.
        self.run_test(
            "AI Grammar Check",
            "POST",
            "ai/assist",
            501,
            data={
                "text": "This are a test sentence with grammar error.",
                "task": "grammar"
            }
        )
        
        # Test rewrite
        self.run_test(
            "AI Rewrite",
            "POST",
            "ai/assist",
            501,
            data={
                "text": "The cat sat on the mat.",
                "task": "rewrite"
            }
        )
        
        # Test tone adjustment
        self.run_test(
            "AI Tone Adjust",
            "POST",
            "ai/assist",
            501,
            data={
                "text": "Hey, what's up? Can you help me with this thing?",
                "task": "tone_adjust",
                "tone": "professional"
            }
        )

    def test_business_user_flow(self):
        """Test business user registration and endpoints"""
        self.log("\n=== TESTING BUSINESS USER FLOW ===")
        
        # Register business user
        business_email = f"test_business_{int(time.time())}@example.com"
        success, response = self.run_test(
            "Register Business User",
            "POST",
            "auth/register",
            200,
            data={
                "email": business_email,
                "password": "TestPass123!",
                "name": "Test Production Company",
                "user_type": "business"
            }
        )
        
        if success and 'token' in response:
            # Store current token and switch to business user
            writer_token = self.token
            self.token = response['token']
            business_user = response['user']
            
            # Test business profile
            self.run_test(
                "Get Business Profile",
                "GET",
                "business/profile",
                200
            )
            
            # Test update business profile
            self.run_test(
                "Update Business Profile",
                "PUT",
                "business/profile",
                200,
                data={
                    "company_name": "Stellar Productions",
                    "industry": "Film Production",
                    "description": "We create compelling stories for film and television.",
                    "website": "https://stellarproductions.com"
                }
            )
            
            # Test get credits
            self.run_test(
                "Get Business Credits",
                "GET",
                "business/credits",
                200
            )
            
            # Test create project
            success, project_response = self.run_test(
                "Create Project",
                "POST",
                "business/projects",
                201,
                data={
                    "title": "Indie Film Script Needed",
                    "description": "Looking for a talented writer to create a screenplay for our upcoming indie film about urban life.",
                    "genre": "Drama",
                    "budget_range": "$5000-10000"
                }
            )
            
            # Test get business projects
            self.run_test(
                "Get Business Projects",
                "GET",
                "business/projects",
                200
            )
            
            # Test discover writers
            self.run_test(
                "Discover Writers",
                "GET",
                "writers/discover",
                200
            )
            
            # Restore writer token
            self.token = writer_token

    def test_projects_endpoint(self):
        """Test general projects endpoint"""
        self.log("\n=== TESTING PROJECTS ENDPOINT ===")
        
        self.run_test(
            "Get All Projects",
            "GET",
            "projects",
            200
        )

    def test_logout(self):
        """Test logout endpoint"""
        self.log("\n=== TESTING LOGOUT ===")
        
        self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )

    def run_all_tests(self):
        """Run all test suites"""
        self.log("🚀 Starting Word Up API Tests")
        self.log(f"Testing against: {self.base_url}")
        
        start_time = time.time()
        
        # Run test suites
        if self.test_auth_flow():
            self.test_writer_endpoints()
            self.test_ai_endpoints()
            self.test_business_user_flow()
            self.test_projects_endpoint()
            self.test_logout()
        
        end_time = time.time()
        
        # Print summary
        self.log(f"\n{'='*50}")
        self.log(f"📊 TEST SUMMARY")
        self.log(f"{'='*50}")
        self.log(f"Total tests: {self.tests_run}")
        self.log(f"Passed: {self.tests_passed}")
        self.log(f"Failed: {len(self.failed_tests)}")
        self.log(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        self.log(f"Duration: {end_time-start_time:.2f}s")
        
        if self.failed_tests:
            self.log(f"\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                self.log(f"  • {test['test']} ({test['endpoint']})")
                self.log(f"    Expected: {test['expected']}, Got: {test['actual']}")
                if test['error']:
                    self.log(f"    Error: {test['error']}")
        
        return len(self.failed_tests) == 0

def main():
    parser = argparse.ArgumentParser(description='Run Word Up API integration checks')
    parser.add_argument('--base-url', default=None, help='Backend base URL (e.g. http://localhost:8000)')
    args = parser.parse_args()

    tester = WordUpAPITester(base_url=args.base_url)
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())