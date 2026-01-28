# Test Suite Documentation

This directory contains comprehensive test cases and automated test configuration for `expo-splash-screen2`.

## Files

- `test-suite.yaml` - YAML configuration for automated test execution
- `README.md` - This file, test documentation
- `test-runner.js` - Example test runner script (to be implemented)

## Test Cases Documentation

See [../docs/test-cases.md](../docs/test-cases.md) for detailed test case descriptions.

## Test Suite Structure

The test suite covers all four modes:

1. **WebView Mode** - HTML content in WebView
2. **ResponsiveImage Mode** - Full-screen background image
3. **Normal Mode** - Centered image with background color (supports dark mode)
4. **Blend Mode** - .9 image background + WebView HTML overlay

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Install test dependencies
npm install --save-dev jest @testing-library/react-native
```

### Manual Testing

Follow the test cases in `docs/test-cases.md`:

1. Create a test Expo project
2. Configure the plugin with the desired mode
3. Run `npx expo prebuild`
4. Build and test on iOS/Android
5. Verify results match expected outcomes

### Automated Testing (YAML)

The `test-suite.yaml` file defines automated tests that can be executed by a test runner.

#### Using a Custom Test Runner

Create a test runner that reads `test-suite.yaml` and executes tests:

```javascript
// Example test runner structure
const yaml = require('js-yaml');
const fs = require('fs');

const testSuite = yaml.load(fs.readFileSync('tests/test-suite.yaml', 'utf8'));

// Execute tests based on YAML configuration
for (const suite of testSuite.test_suites) {
  for (const test of suite.tests) {
    // Execute test steps
    executeTest(test);
  }
}
```

#### Using CI/CD Integration

The YAML test suite can be integrated with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
name: Test expo-splash-screen2

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:yaml
```

## Test Categories

### 1. Mode-Specific Tests

Each mode has dedicated test cases:
- Basic configuration
- Custom options
- Platform-specific behavior

### 2. Cross-Mode Tests

Tests that apply across all modes:
- Mode switching
- API functions
- Prebuild cleanup

### 3. Platform-Specific Tests

iOS and Android specific tests:
- File generation
- Configuration files
- Native code modifications

### 4. Error Handling Tests

Tests for error scenarios:
- Missing files
- Invalid configuration
- Edge cases

### 5. Integration Tests

Tests for integration with:
- Expo Router
- React Navigation
- Other Expo modules

## Test Execution Flow

1. **Setup** - Create test project, install dependencies
2. **Configure** - Set up plugin configuration for test mode
3. **Prebuild** - Run `npx expo prebuild`
4. **Verify Files** - Check generated files exist and are correct
5. **Build** - Build iOS/Android apps
6. **Test** - Run app and verify behavior
7. **Assert** - Verify expected results
8. **Cleanup** - Clean up test artifacts

## YAML Test Structure

Each test in `test-suite.yaml` follows this structure:

```yaml
- name: Test Name
  id: test_id
  mode: webview|responsiveImage|normal|blend
  config:
    # Plugin configuration
  steps:
    - name: Step description
      action: action_name
      params:
        # Action parameters
      expected_result: success|failure
  assertions:
    - type: assertion_type
      # Assertion parameters
```

### Available Actions

- `create_project` - Create new Expo project
- `configure_plugin` - Configure plugin in app.json
- `run_prebuild` - Execute expo prebuild
- `verify_files` - Check files exist
- `verify_file_content` - Check file content
- `build_app` - Build iOS/Android app
- `test_api_function` - Test API functions
- `copy_file` - Copy test files
- `create_file` - Create test files

### Available Assertions

- `file_exists` - Verify file exists
- `file_content` - Verify file content
- `image_exists` - Verify image file exists
- `image_width` - Verify image width
- `dark_mode_support` - Verify dark mode support
- `no_errors` - Verify no errors in logs
- `no_flickering` - Verify no visual flickering
- `api_works` - Verify API functions work

## Writing New Tests

To add a new test:

1. Add test case to `docs/test-cases.md`
2. Add corresponding YAML test to `test-suite.yaml`
3. Ensure test follows the structure:
   - Clear test name and ID
   - Appropriate mode configuration
   - Step-by-step actions
   - Assertions for verification

## Test Coverage

Current test coverage:

- ✅ WebView mode (3 tests)
- ✅ ResponsiveImage mode (2 tests)
- ✅ Normal mode (3 tests)
- ✅ Blend mode (3 tests)
- ✅ Cross-mode tests (2 tests)
- ✅ Platform-specific tests (3 tests)
- ✅ Error handling tests (2 tests)

Total: ~20 test cases covering all major functionality.

## Continuous Improvement

- Add performance benchmarks
- Add visual regression tests
- Add accessibility tests
- Expand error handling coverage
- Add more integration test scenarios
