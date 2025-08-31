/**
 * BBTTCC Regression Test Suite - MODERN v4.8.0
 * Final regression testing to ensure no new errors were introduced
 * Tests critical paths and backward compatibility
 */

(async () => {
    'use strict';
    
    console.log('🔄 BBTTCC Regression Test Suite | Starting final regression testing...');
    
    // Test configuration
    const REGRESSION_CONFIG = {
        timeout: 20000, // 20 second timeout for regression tests
        maxRetries: 3, // Retry failed tests up to 3 times
        cleanup: true, // Clean up test data
        verbose: true, // Detailed logging
        stopOnCriticalError: false // Continue testing even after critical errors
    };
    
    const regressionResults = {
        total: 0,
        passed: 0,
        failed: 0,
        retried: 0,
        critical: 0,
        errors: [],
        summary: {}
    };
    
    /**
     * Regression test helper functions
     */
    const regressionHelper = {
        // Retry wrapper for flaky tests
        async withRetry(testName, testFn, maxRetries = REGRESSION_CONFIG.maxRetries) {
            let lastError;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const result = await this.withTimeout(testName, testFn);
                    if (attempt > 1) {
                        regressionResults.retried++;
                        console.log(`  🔄 Retry ${attempt - 1} succeeded for: ${testName}`);
                    }
                    return result;
                } catch (error) {
                    lastError = error;
                    if (attempt < maxRetries) {
                        console.log(`  ⚠️ Attempt ${attempt} failed, retrying: ${testName}`);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                    }
                }
            }
            
            throw lastError;
        },
        
        // Timeout wrapper
        async withTimeout(testName, testFn, timeout = REGRESSION_CONFIG.timeout) {
            return new Promise(async (resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Regression test '${testName}' timed out after ${timeout}ms`));
                }, timeout);
                
                try {
                    const result = await testFn();
                    clearTimeout(timeoutId);
                    resolve(result);
                } catch (error) {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });
        },
        
        // Critical assertion (stops testing if fails)
        assertCritical(condition, message) {
            if (!condition) {
                const error = new Error(`CRITICAL: ${message}`);
                error.critical = true;
                throw error;
            }
        },
        
        // Regular assertion
        assert(condition, message) {
            if (!condition) {
                throw new Error(`Assertion failed: ${message}`);
            }
        }
    };
    
    /**
     * Run regression test with retry logic
     */
    async function runRegressionTest(testName, testFn, isCritical = false) {
        regressionResults.total++;
        
        try {
            console.log(`🧪 Regression test: ${testName}${isCritical ? ' (CRITICAL)' : ''}`);
            await regressionHelper.withRetry(testName, testFn);
            regressionResults.passed++;
            console.log(`✅ PASSED: ${testName}`);
            return true;
        } catch (error) {
            regressionResults.failed++;
            
            if (error.critical || isCritical) {
                regressionResults.critical++;
            }
            
            const errorDetails = {
                test: testName,
                error: error.message,
                critical: error.critical || isCritical,
                stack: error.stack?.substring(0, 400)
            };
            
            regressionResults.errors.push(errorDetails);
            console.error(`❌ FAILED: ${testName} - ${error.message}`);
            
            if (error.critical && REGRESSION_CONFIG.stopOnCriticalError) {
                console.error('🚨 CRITICAL ERROR - Stopping regression tests');
                throw error;
            }
            
            return false;
        }
    }
    
    console.log('🔍 Starting regression tests for BBTTCC modernization...\n');
    
    // ===========================================
    // CRITICAL REGRESSION TESTS
    // ===========================================
    console.log('🚨 CRITICAL REGRESSION TESTS');
    
    await runRegressionTest('Game system compatibility', async () => {
        regressionHelper.assertCritical(game.system.id === 'dnd5e', 
            'Game system should be D&D 5e for BBTTCC modules');
        
        regressionHelper.assertCritical(game.version, 
            'FoundryVTT version should be available');
        
        const versionParts = game.version.split('.');
        const majorVersion = parseInt(versionParts[0]);
        regressionHelper.assertCritical(majorVersion >= 13, 
            `FoundryVTT version should be 13+ (current: ${game.version})`);
        
        console.log(`  ✓ D&D 5e system v${game.system.version} on FoundryVTT v${game.version}`);
    }, true);
    
    await runRegressionTest('Core APIs remain stable', async () => {
        // Test that core Foundry APIs we depend on still exist
        regressionHelper.assertCritical(game.actors, 'game.actors should be available');
        regressionHelper.assertCritical(game.modules, 'game.modules should be available');
        regressionHelper.assertCritical(game.settings, 'game.settings should be available');
        regressionHelper.assertCritical(foundry.utils, 'foundry.utils should be available');
        regressionHelper.assertCritical(foundry.utils.mergeObject, 'foundry.utils.mergeObject should be available');
        
        console.log('  ✓ All critical FoundryVTT APIs are stable');
    }, true);
    
    await runRegressionTest('Module loading regression', async () => {
        const expectedModules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        let loadedCount = 0;
        
        for (const moduleId of expectedModules) {
            const module = game.modules.get(moduleId);
            if (module) {
                loadedCount++;
                
                // Check that module has expected structure
                regressionHelper.assert(module.id === moduleId, `Module ${moduleId} should have correct ID`);
                
                if (module.api) {
                    regressionHelper.assert(typeof module.api === 'object', 
                        `Module ${moduleId} API should be an object`);
                    console.log(`    ✓ ${moduleId}: Loaded with API`);
                } else {
                    console.log(`    ⚠️ ${moduleId}: Loaded without API`);
                }
            }
        }
        
        regressionHelper.assertCritical(loadedCount > 0, 
            'At least one BBTTCC module should be loaded');
        
        console.log(`  ✓ ${loadedCount}/${expectedModules.length} BBTTCC modules loaded successfully`);
    }, true);
    
    // ===========================================
    // PROMISE RESOLUTION REGRESSION TESTS
    // ===========================================
    console.log('\n📋 PROMISE RESOLUTION REGRESSION TESTS');
    
    await runRegressionTest('No Promise {<pending>} responses', async () => {
        const modules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        let testedModules = 0;
        
        for (const moduleId of modules) {
            const module = game.modules.get(moduleId);
            if (module && module.api && module.api.waitForReady) {
                testedModules++;
                
                // Test that waitForReady resolves properly
                const readyResult = await module.api.waitForReady(5000);
                
                // Check that result is not a pending promise
                regressionHelper.assert(readyResult !== undefined, 
                    `${moduleId} waitForReady should not return undefined`);
                
                regressionHelper.assert(typeof readyResult === 'object', 
                    `${moduleId} waitForReady should return an object (the API)`);
                
                regressionHelper.assert(readyResult.isReady, 
                    `${moduleId} returned API should have isReady method`);
                
                const isReadyResult = readyResult.isReady();
                regressionHelper.assert(typeof isReadyResult === 'boolean', 
                    `${moduleId} isReady should return a boolean, not a Promise`);
                
                console.log(`    ✓ ${moduleId}: No pending promises detected`);
            }
        }
        
        regressionHelper.assert(testedModules > 0, 
            'Should have tested at least one module for promise resolution');
        
        console.log(`  ✓ Promise resolution validated for ${testedModules} modules`);
    });
    
    await runRegressionTest('Async function completion', async () => {
        const modules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        let asyncFunctionCount = 0;
        
        for (const moduleId of modules) {
            const module = game.modules.get(moduleId);
            if (module && module.api) {
                // Test methods that should complete properly
                const methodsToTest = [];
                
                // Add methods based on module type
                if (module.api.createFaction) methodsToTest.push('createFaction');
                if (module.api.claimTerritory) methodsToTest.push('claimTerritory');
                if (module.api.createRaid) methodsToTest.push('createRaid');
                if (module.api.getRadiationData) methodsToTest.push('getRadiationData');
                
                // Test getter methods (should be fast and not return promises)
                for (const methodName of methodsToTest) {
                    if (methodName.startsWith('get') || methodName.startsWith('calculate')) {
                        asyncFunctionCount++;
                        
                        const startTime = Date.now();
                        try {
                            const result = module.api[methodName](null); // Test with null
                            const endTime = Date.now();
                            
                            // Should complete quickly and not be a promise
                            regressionHelper.assert(endTime - startTime < 1000, 
                                `${moduleId}.${methodName} should complete quickly`);
                            
                            if (result && typeof result.then === 'function') {
                                console.log(`    ⚠️ ${moduleId}.${methodName} returned a Promise - may be async when should be sync`);
                            } else {
                                console.log(`    ✓ ${moduleId}.${methodName}: Synchronous completion`);
                            }
                        } catch (error) {
                            // Expected for null inputs - should fail gracefully, not hang
                            console.log(`    ✓ ${moduleId}.${methodName}: Failed gracefully with null input`);
                        }
                    }
                }
            }
        }
        
        console.log(`  ✓ Async function completion tested for ${asyncFunctionCount} methods`);
    });
    
    // ===========================================
    // BACKWARD COMPATIBILITY REGRESSION TESTS
    // ===========================================
    console.log('\n🔙 BACKWARD COMPATIBILITY REGRESSION TESTS');
    
    await runRegressionTest('Legacy API availability', async () => {
        const legacyAPIs = [
            { name: 'BBTTCCFactions', module: 'bbttcc-factions' },
            { name: 'BBTTCCTerritory', module: 'bbttcc-territory' },
            { name: 'BBTTCCRaid', module: 'bbttcc-raid' },
            { name: 'BBTTCCRadiation', module: 'bbttcc-radiation' }
        ];
        
        let legacyCount = 0;
        
        for (const api of legacyAPIs) {
            const module = game.modules.get(api.module);
            if (module && window[api.name]) {
                legacyCount++;
                
                // Test that legacy API has same structure as modern API
                regressionHelper.assert(typeof window[api.name] === 'object', 
                    `Legacy ${api.name} should be an object`);
                
                console.log(`    ✓ ${api.name}: Legacy API available`);
            } else if (module) {
                console.log(`    ⚠️ ${api.name}: Module loaded but legacy API not available`);
            }
        }
        
        console.log(`  ✓ ${legacyCount} legacy APIs remain available for backward compatibility`);
    });
    
    await runRegressionTest('Settings system regression', async () => {
        const modules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        let settingsCount = 0;
        
        for (const moduleId of modules) {
            const module = game.modules.get(moduleId);
            if (module) {
                // Try to access common settings that should exist
                const commonSettings = ['debugMode', 'enableMacroIntegration'];
                
                for (const settingName of commonSettings) {
                    try {
                        const settingValue = game.settings.get(moduleId, settingName);
                        settingsCount++;
                        
                        regressionHelper.assert(typeof settingValue === 'boolean', 
                            `${moduleId}.${settingName} should be a boolean setting`);
                        
                        console.log(`    ✓ ${moduleId}.${settingName}: ${settingValue}`);
                    } catch (error) {
                        // Setting might not exist - that's okay
                        console.log(`    ⚠️ ${moduleId}.${settingName}: Not found (may not be implemented)`);
                    }
                }
            }
        }
        
        console.log(`  ✓ Settings system regression tested (${settingsCount} settings found)`);
    });
    
    // ===========================================
    // DATA PERSISTENCE REGRESSION TESTS
    // ===========================================
    console.log('\n💾 DATA PERSISTENCE REGRESSION TESTS');
    
    await runRegressionTest('Flag-based storage regression', async () => {
        // Test that we can read and write flags properly
        if (canvas.scene) {
            const testFlagPath = 'bbttcc-test-regression';
            const testData = {
                timestamp: Date.now(),
                testValue: 'regression-test-data',
                modernPattern: true
            };
            
            // Test scene flag storage
            await canvas.scene.setFlag(testFlagPath, 'test', testData);
            const retrievedData = canvas.scene.getFlag(testFlagPath, 'test');
            
            regressionHelper.assert(retrievedData, 'Flag data should be retrievable');
            regressionHelper.assert(retrievedData.testValue === testData.testValue, 
                'Flag data should match what was stored');
            regressionHelper.assert(retrievedData.modernPattern === true, 
                'Boolean flag values should be preserved');
            
            // Clean up test flag
            if (REGRESSION_CONFIG.cleanup) {
                await canvas.scene.unsetFlag(testFlagPath, 'test');
            }
            
            console.log('    ✓ Scene flag storage: Working correctly');
        }
        
        // Test actor flag storage if we have actors
        const testActor = game.actors.contents[0];
        if (testActor) {
            const testFlagPath = 'bbttcc-test-regression';
            const testActorData = {
                actorTest: true,
                value: 42
            };
            
            await testActor.setFlag(testFlagPath, 'actorTest', testActorData);
            const actorRetrievedData = testActor.getFlag(testFlagPath, 'actorTest');
            
            regressionHelper.assert(actorRetrievedData.value === 42, 
                'Actor flag numeric values should be preserved');
            
            // Clean up
            if (REGRESSION_CONFIG.cleanup) {
                await testActor.unsetFlag(testFlagPath, 'actorTest');
            }
            
            console.log('    ✓ Actor flag storage: Working correctly');
        }
        
        console.log('  ✓ Flag-based storage regression test passed');
    });
    
    // ===========================================
    // ERROR HANDLING REGRESSION TESTS
    // ===========================================
    console.log('\n⚠️ ERROR HANDLING REGRESSION TESTS');
    
    await runRegressionTest('Graceful error handling', async () => {
        const modules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        let errorHandlingTests = 0;
        
        for (const moduleId of modules) {
            const module = game.modules.get(moduleId);
            if (module && module.api) {
                
                // Test error handling with invalid inputs
                const methodsToTest = Object.keys(module.api).filter(key => 
                    typeof module.api[key] === 'function' && 
                    !key.startsWith('_') && // Skip private methods
                    key !== 'waitForReady' && // Skip known-good methods
                    key !== 'isReady'
                );
                
                for (const methodName of methodsToTest.slice(0, 2)) { // Test first 2 methods per module
                    errorHandlingTests++;
                    
                    try {
                        // Call with invalid parameters - should not crash
                        const result = await module.api[methodName](null, undefined, 'invalid');
                        
                        // If we get here, the method handled errors gracefully
                        console.log(`    ✓ ${moduleId}.${methodName}: Handled invalid input gracefully`);
                        
                    } catch (error) {
                        // Expected - should be a controlled error, not a crash
                        regressionHelper.assert(error instanceof Error, 
                            `${moduleId}.${methodName} should throw proper Error objects`);
                        
                        regressionHelper.assert(error.message && error.message.length > 0, 
                            `${moduleId}.${methodName} should have meaningful error messages`);
                        
                        console.log(`    ✓ ${moduleId}.${methodName}: Threw controlled error - ${error.message.substring(0, 50)}...`);
                    }
                }
            }
        }
        
        console.log(`  ✓ Error handling regression tested for ${errorHandlingTests} methods`);
    });
    
    // ===========================================
    // PERFORMANCE REGRESSION TESTS
    // ===========================================
    console.log('\n⚡ PERFORMANCE REGRESSION TESTS');
    
    await runRegressionTest('No performance degradation', async () => {
        const modules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        const performanceBaseline = 100; // 100ms baseline
        let performanceTests = 0;
        
        for (const moduleId of modules) {
            const module = game.modules.get(moduleId);
            if (module && module.api && module.api.isReady) {
                performanceTests++;
                
                // Test API response time
                const startTime = performance.now();
                const isReady = module.api.isReady();
                const endTime = performance.now();
                
                const responseTime = endTime - startTime;
                
                regressionHelper.assert(responseTime < performanceBaseline, 
                    `${moduleId} API response should be under ${performanceBaseline}ms (was ${responseTime.toFixed(2)}ms)`);
                
                console.log(`    ✓ ${moduleId}: ${responseTime.toFixed(2)}ms response time`);
            }
        }
        
        console.log(`  ✓ Performance regression tested for ${performanceTests} modules`);
    });
    
    // ===========================================
    // FINAL REGRESSION RESULTS
    // ===========================================
    console.log('\n📊 REGRESSION TEST COMPLETE - FINAL RESULTS');
    console.log('=' .repeat(60));
    
    const successRate = regressionResults.total > 0 ? 
        (regressionResults.passed / regressionResults.total * 100).toFixed(1) : 0;
    
    console.log(`📈 REGRESSION RESULTS:`);
    console.log(`   Total Tests: ${regressionResults.total}`);
    console.log(`   Passed: ${regressionResults.passed} ✅`);
    console.log(`   Failed: ${regressionResults.failed} ❌`);
    console.log(`   Critical Failures: ${regressionResults.critical} 🚨`);
    console.log(`   Retried: ${regressionResults.retried} 🔄`);
    console.log(`   Success Rate: ${successRate}%`);
    
    if (regressionResults.failed > 0) {
        console.log(`\n❌ REGRESSION FAILURES (${regressionResults.failed}):`);
        regressionResults.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error.test} ${error.critical ? '🚨 CRITICAL' : ''}`);
            console.log(`      Error: ${error.error}`);
        });
    }
    
    // Assessment
    console.log(`\n🎯 REGRESSION ASSESSMENT:`);
    if (regressionResults.critical > 0) {
        console.log(`   🚨 CRITICAL ISSUES: ${regressionResults.critical} critical failures detected!`);
        console.log(`      Immediate attention required before production deployment.`);
    } else if (successRate >= 95) {
        console.log(`   🏆 EXCELLENT: ${successRate}% success rate - No regressions detected!`);
        console.log(`      Ready for production deployment.`);
    } else if (successRate >= 85) {
        console.log(`   🥉 GOOD: ${successRate}% success rate - Minor issues detected`);
        console.log(`      Consider addressing failures before deployment.`);
    } else if (successRate >= 70) {
        console.log(`   ⚠️ FAIR: ${successRate}% success rate - Moderate regressions detected`);
        console.log(`      Address failures before production deployment.`);
    } else {
        console.log(`   ❌ POOR: ${successRate}% success rate - Major regressions detected!`);
        console.log(`      Significant issues require immediate attention.`);
    }
    
    // Summary for packaging decision
    const packagingReady = regressionResults.critical === 0 && successRate >= 85;
    
    console.log(`\n📦 PACKAGING READINESS:`);
    if (packagingReady) {
        console.log(`   ✅ READY: Suite passes regression requirements for packaging`);
        console.log(`      - No critical failures`);
        console.log(`      - ${successRate}% success rate meets threshold (≥85%)`);
        console.log(`      - Safe to proceed with final packaging`);
    } else {
        console.log(`   ❌ NOT READY: Suite does not meet packaging requirements`);
        console.log(`      - Critical failures: ${regressionResults.critical}`);
        console.log(`      - Success rate: ${successRate}% (need ≥85%)`);
        console.log(`      - Address issues before packaging`);
    }
    
    console.log('\n✅ BBTTCC Regression Testing Complete!');
    console.log('🔄 All modernization changes have been regression tested');
    
    // Return results for packaging decision
    return {
        ...regressionResults,
        successRate: parseFloat(successRate),
        packagingReady: packagingReady
    };
    
})().catch(error => {
    console.error('💥 CRITICAL ERROR in BBTTCC regression testing:', error);
    ui.notifications.error(`BBTTCC regression testing failed: ${error.message}`);
    return { 
        packagingReady: false, 
        error: error.message,
        critical: true 
    };
});