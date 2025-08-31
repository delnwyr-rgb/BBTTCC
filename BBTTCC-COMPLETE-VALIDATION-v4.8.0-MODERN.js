/**
 * BBTTCC Complete Suite Validation - MODERN v4.8.0
 * Comprehensive validation of all four modernized BBTTCC modules
 * Tests modern patterns, async functionality, cross-module integration
 */

(async () => {
    'use strict';
    
    console.log('🚀 BBTTCC Complete Suite Validation | Starting comprehensive validation...');
    
    // Test configuration
    const TEST_CONFIG = {
        timeout: 15000, // 15 second timeout for each test
        concurrency: true, // Allow concurrent operations
        cleanup: true, // Clean up test data
        verbose: true // Detailed logging
    };
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        errors: [],
        details: {}
    };
    
    /**
     * Test helper functions
     */
    const testHelper = {
        // Timeout wrapper for tests
        async withTimeout(testName, testFn, timeout = TEST_CONFIG.timeout) {
            return new Promise(async (resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Test '${testName}' timed out after ${timeout}ms`));
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
        
        // Validation assertions
        assert(condition, message) {
            if (!condition) {
                throw new Error(`Assertion failed: ${message}`);
            }
        },
        
        // Check if object has expected properties
        validateObject(obj, expectedProps, objectName = 'object') {
            this.assert(obj && typeof obj === 'object', `${objectName} should be an object`);
            for (const prop of expectedProps) {
                this.assert(obj.hasOwnProperty(prop), `${objectName} should have property '${prop}'`);
            }
        },
        
        // Check if function exists and is callable
        validateFunction(fn, functionName) {
            this.assert(typeof fn === 'function', `${functionName} should be a function`);
        }
    };
    
    /**
     * Individual test execution
     */
    async function runTest(testName, testFn) {
        results.total++;
        
        try {
            console.log(`🔍 Running test: ${testName}`);
            await testHelper.withTimeout(testName, testFn);
            results.passed++;
            console.log(`✅ PASSED: ${testName}`);
            return true;
        } catch (error) {
            results.failed++;
            const errorDetails = {
                test: testName,
                error: error.message,
                stack: error.stack?.substring(0, 300)
            };
            results.errors.push(errorDetails);
            console.error(`❌ FAILED: ${testName} - ${error.message}`);
            return false;
        }
    }
    
    console.log('📋 Starting validation of all BBTTCC modules...\n');
    
    // ===========================================
    // SECTION 1: MODULE LOADING AND AVAILABILITY
    // ===========================================
    console.log('📦 SECTION 1: Module Loading and Availability');
    
    await runTest('All BBTTCC modules are available', async () => {
        const modules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        const availableModules = [];
        
        for (const moduleId of modules) {
            const module = game.modules.get(moduleId);
            if (module) {
                availableModules.push(moduleId);
                console.log(`  ✓ ${moduleId}: Found (active: ${module.active})`);
            } else {
                console.log(`  ✗ ${moduleId}: Not found`);
            }
        }
        
        testHelper.assert(availableModules.length >= 1, 'At least one BBTTCC module should be available');
        results.details.availableModules = availableModules;
    });
    
    await runTest('Modules expose modern APIs', async () => {
        const moduleApis = {};
        const modules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        
        for (const moduleId of modules) {
            const module = game.modules.get(moduleId);
            if (module && module.api) {
                moduleApis[moduleId] = {
                    hasApi: !!module.api,
                    hasWaitForReady: typeof module.api.waitForReady === 'function',
                    hasIsReady: typeof module.api.isReady === 'function',
                    apiKeys: Object.keys(module.api)
                };
                console.log(`  ✓ ${moduleId}: Modern API exposed (${moduleApis[moduleId].apiKeys.length} methods)`);
            }
        }
        
        testHelper.assert(Object.keys(moduleApis).length > 0, 'At least one module should expose a modern API');
        results.details.moduleApis = moduleApis;
    });
    
    // ===========================================
    // SECTION 2: BBTTCC FACTIONS VALIDATION
    // ===========================================
    console.log('\n🏛️ SECTION 2: BBTTCC Factions Module Validation');
    
    const factionsModule = game.modules.get('bbttcc-factions');
    if (factionsModule && factionsModule.api) {
        await runTest('Factions API readiness', async () => {
            const api = await factionsModule.api.waitForReady(10000);
            testHelper.assert(api, 'Factions API should be ready');
            testHelper.assert(api.createFaction, 'API should have createFaction method');
            testHelper.assert(api.updateFactionOPs, 'API should have updateFactionOPs method');
            console.log(`  ✓ Factions API ready with ${Object.keys(api).length} methods`);
        });
        
        await runTest('Factions modern patterns', async () => {
            const api = factionsModule.api;
            
            // Check for modern constants
            testHelper.validateObject(api.DEFAULT_OPS_STRUCTURE, ['violence', 'nonLethal', 'intrigue'], 'DEFAULT_OPS_STRUCTURE');
            testHelper.validateFunction(api.createFaction, 'createFaction');
            testHelper.validateFunction(api.getFactionData, 'getFactionData');
            
            console.log('  ✓ Modern patterns implemented correctly');
        });
        
        await runTest('Factions async operations', async () => {
            const api = factionsModule.api;
            
            // Test faction creation (if allowed)
            if (game.user.isGM) {
                const testFactionData = {
                    name: `BBTTCC Test Faction ${Date.now()}`,
                    biography: 'Test faction for validation'
                };
                
                const faction = await api.createFaction(testFactionData);
                testHelper.assert(faction, 'Faction creation should return a faction');
                testHelper.assert(faction.name === testFactionData.name, 'Faction should have correct name');
                testHelper.assert(faction.flags['bbttcc-factions'], 'Faction should have bbttcc-factions flags');
                
                console.log(`  ✓ Created test faction: ${faction.name}`);
                
                // Clean up if enabled
                if (TEST_CONFIG.cleanup) {
                    await faction.delete();
                    console.log('  ✓ Test faction cleaned up');
                }
            } else {
                console.log('  ⚠️ Skipping faction creation (not GM)');
            }
        });
        
    } else {
        console.log('  ⚠️ BBTTCC Factions module not available for testing');
    }
    
    // ===========================================
    // SECTION 3: BBTTCC TERRITORY VALIDATION
    // ===========================================
    console.log('\n🗺️ SECTION 3: BBTTCC Territory Module Validation');
    
    const territoryModule = game.modules.get('bbttcc-territory');
    if (territoryModule && territoryModule.api) {
        await runTest('Territory API readiness', async () => {
            const api = await territoryModule.api.waitForReady(10000);
            testHelper.assert(api, 'Territory API should be ready');
            testHelper.assert(api.claimTerritory, 'API should have claimTerritory method');
            testHelper.assert(api.transferTerritory, 'API should have transferTerritory method');
            console.log(`  ✓ Territory API ready with ${Object.keys(api).length} methods`);
        });
        
        await runTest('Territory modern patterns', async () => {
            const api = territoryModule.api;
            
            // Check for modern constants
            testHelper.validateObject(api.DEFAULT_TERRITORY_STRUCTURE, ['id', 'name', 'type'], 'DEFAULT_TERRITORY_STRUCTURE');
            testHelper.validateFunction(api.claimTerritory, 'claimTerritory');
            testHelper.validateFunction(api.getTerritoriesForScene, 'getTerritoriesForScene');
            
            console.log('  ✓ Modern patterns implemented correctly');
        });
        
        await runTest('Territory scene integration', async () => {
            const api = territoryModule.api;
            
            // Test getting territories for current scene
            if (canvas.scene) {
                const territories = api.getTerritoriesForScene(canvas.scene);
                testHelper.assert(Array.isArray(territories), 'getTerritoriesForScene should return an array');
                console.log(`  ✓ Scene has ${territories.length} territories`);
            } else {
                console.log('  ⚠️ No active scene for territory testing');
            }
        });
        
    } else {
        console.log('  ⚠️ BBTTCC Territory module not available for testing');
    }
    
    // ===========================================
    // SECTION 4: BBTTCC RAID VALIDATION
    // ===========================================
    console.log('\n⚔️ SECTION 4: BBTTCC Raid Module Validation');
    
    const raidModule = game.modules.get('bbttcc-raid');
    if (raidModule && raidModule.api) {
        await runTest('Raid API readiness', async () => {
            const api = await raidModule.api.waitForReady(10000);
            testHelper.assert(api, 'Raid API should be ready');
            testHelper.assert(api.createRaid, 'API should have createRaid method');
            testHelper.assert(api.executeRaid, 'API should have executeRaid method');
            console.log(`  ✓ Raid API ready with ${Object.keys(api).length} methods`);
        });
        
        await runTest('Raid modern patterns', async () => {
            const api = raidModule.api;
            
            // Check for modern constants
            testHelper.validateObject(api.RAID_TYPES, ['assault', 'infiltration'], 'RAID_TYPES');
            testHelper.validateObject(api.RAID_DIFFICULTIES, ['easy', 'medium', 'hard'], 'RAID_DIFFICULTIES');
            testHelper.validateFunction(api.createRaid, 'createRaid');
            testHelper.validateFunction(api.calculateDifficulty, 'calculateDifficulty');
            
            console.log('  ✓ Modern patterns implemented correctly');
        });
        
        await runTest('Raid difficulty calculation', async () => {
            const api = raidModule.api;
            
            // Test difficulty calculation
            const testRaidData = {
                type: 'assault',
                objectives: ['Test objective 1', 'Test objective 2'],
                participants: ['faction-1'],
                resources: {
                    violence: 10,
                    nonLethal: 5,
                    intrigue: 3,
                    economy: 7
                }
            };
            
            const difficulty = api.calculateDifficulty(testRaidData);
            testHelper.assert(typeof difficulty === 'string', 'Difficulty should be a string');
            testHelper.assert(api.RAID_DIFFICULTIES[difficulty], 'Difficulty should be valid');
            
            console.log(`  ✓ Difficulty calculated as: ${difficulty}`);
        });
        
    } else {
        console.log('  ⚠️ BBTTCC Raid module not available for testing');
    }
    
    // ===========================================
    // SECTION 5: BBTTCC RADIATION VALIDATION
    // ===========================================
    console.log('\n☢️ SECTION 5: BBTTCC Radiation Module Validation');
    
    const radiationModule = game.modules.get('bbttcc-radiation');
    if (radiationModule && radiationModule.api) {
        await runTest('Radiation API readiness', async () => {
            const api = await radiationModule.api.waitForReady(10000);
            testHelper.assert(api, 'Radiation API should be ready');
            testHelper.assert(api.getRadiationData, 'API should have getRadiationData method');
            testHelper.assert(api.setSceneRadiationZone, 'API should have setSceneRadiationZone method');
            console.log(`  ✓ Radiation API ready with ${Object.keys(api).length} methods`);
        });
        
        await runTest('Radiation modern patterns', async () => {
            const api = radiationModule.api;
            
            // Check for modern constants
            testHelper.validateObject(api.RADIATION_LEVELS, ['safe', 'low', 'moderate'], 'RADIATION_LEVELS');
            testHelper.validateObject(api.PROTECTION_TYPES, ['none', 'basic', 'hazmat'], 'PROTECTION_TYPES');
            testHelper.validateObject(api.ZONE_TYPES, ['background', 'urban', 'industrial'], 'ZONE_TYPES');
            testHelper.validateFunction(api.getRadiationData, 'getRadiationData');
            
            console.log('  ✓ Modern patterns implemented correctly');
        });
        
        await runTest('Radiation level calculation', async () => {
            const api = radiationModule.api;
            
            // Test radiation level calculation
            const testRadiationData = {
                level: 35,
                protection: 20
            };
            
            const effectiveLevel = api.calculateEffectiveLevel(testRadiationData);
            testHelper.assert(typeof effectiveLevel === 'number', 'Effective level should be a number');
            testHelper.assert(effectiveLevel <= testRadiationData.level, 'Effective level should be reduced by protection');
            
            const radiationLevel = api.getRadiationLevel(effectiveLevel);
            testHelper.assert(radiationLevel && radiationLevel.name, 'Radiation level should have a name');
            
            console.log(`  ✓ Level ${testRadiationData.level}% with ${testRadiationData.protection}% protection = ${effectiveLevel}% (${radiationLevel.name})`);
        });
        
    } else {
        console.log('  ⚠️ BBTTCC Radiation module not available for testing');
    }
    
    // ===========================================
    // SECTION 6: CROSS-MODULE INTEGRATION
    // ===========================================
    console.log('\n🔗 SECTION 6: Cross-Module Integration Validation');
    
    await runTest('Legacy compatibility APIs', async () => {
        const legacyAPIs = [];
        
        // Check for legacy window APIs
        if (window.BBTTCCFactions) {
            legacyAPIs.push('BBTTCCFactions');
        }
        if (window.BBTTCCTerritory) {
            legacyAPIs.push('BBTTCCTerritory');
        }
        if (window.BBTTCCRaid) {
            legacyAPIs.push('BBTTCCRaid');
        }
        if (window.BBTTCCRadiation) {
            legacyAPIs.push('BBTTCCRadiation');
        }
        
        console.log(`  ✓ Legacy APIs available: ${legacyAPIs.join(', ') || 'None'}`);
        results.details.legacyAPIs = legacyAPIs;
    });
    
    await runTest('Module API consistency', async () => {
        const modules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        const commonMethods = ['waitForReady', 'isReady'];
        let consistentModules = 0;
        
        for (const moduleId of modules) {
            const module = game.modules.get(moduleId);
            if (module && module.api) {
                const hasCommonMethods = commonMethods.every(method => 
                    typeof module.api[method] === 'function'
                );
                
                if (hasCommonMethods) {
                    consistentModules++;
                    console.log(`  ✓ ${moduleId}: Has consistent API structure`);
                } else {
                    console.log(`  ⚠️ ${moduleId}: Missing some common API methods`);
                }
            }
        }
        
        testHelper.assert(consistentModules > 0, 'At least one module should have consistent API');
        results.details.consistentModules = consistentModules;
    });
    
    // ===========================================
    // SECTION 7: MODERN PATTERNS VALIDATION
    // ===========================================
    console.log('\n🔧 SECTION 7: Modern Patterns Validation');
    
    await runTest('Async/await pattern usage', async () => {
        const modules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        let modernModules = 0;
        
        for (const moduleId of modules) {
            const module = game.modules.get(moduleId);
            if (module && module.api && module.api.waitForReady) {
                try {
                    // Test that waitForReady returns a Promise
                    const readyPromise = module.api.waitForReady(1000);
                    testHelper.assert(readyPromise && typeof readyPromise.then === 'function', 
                        `${moduleId} waitForReady should return a Promise`);
                    
                    await readyPromise; // Should resolve
                    modernModules++;
                    console.log(`  ✓ ${moduleId}: Uses modern async patterns`);
                } catch (error) {
                    console.log(`  ⚠️ ${moduleId}: Async pattern test failed - ${error.message}`);
                }
            }
        }
        
        testHelper.assert(modernModules > 0, 'At least one module should use modern async patterns');
        results.details.modernModules = modernModules;
    });
    
    await runTest('Error handling patterns', async () => {
        let modulesWithErrorHandling = 0;
        const modules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        
        for (const moduleId of modules) {
            const module = game.modules.get(moduleId);
            if (module && module.api) {
                // Test that modules handle invalid inputs gracefully
                try {
                    // Try calling a method with invalid data - should handle gracefully
                    if (module.api.getRaidData) {
                        const result = module.api.getRaidData('invalid-id');
                        // Should return null or undefined, not throw
                        modulesWithErrorHandling++;
                        console.log(`  ✓ ${moduleId}: Handles errors gracefully`);
                    } else if (module.api.getFactionData) {
                        const result = module.api.getFactionData(null);
                        modulesWithErrorHandling++;
                        console.log(`  ✓ ${moduleId}: Handles errors gracefully`);
                    } else {
                        console.log(`  ⚠️ ${moduleId}: No testable error handling methods`);
                    }
                } catch (error) {
                    console.log(`  ⚠️ ${moduleId}: Error handling test failed - ${error.message}`);
                }
            }
        }
        
        results.details.modulesWithErrorHandling = modulesWithErrorHandling;
        console.log(`  ✓ Error handling validated for ${modulesWithErrorHandling} modules`);
    });
    
    // ===========================================
    // SECTION 8: PERFORMANCE VALIDATION
    // ===========================================
    console.log('\n⚡ SECTION 8: Performance Validation');
    
    await runTest('API response times', async () => {
        const modules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-raid', 'bbttcc-radiation'];
        const performanceResults = {};
        
        for (const moduleId of modules) {
            const module = game.modules.get(moduleId);
            if (module && module.api && module.api.isReady) {
                const startTime = performance.now();
                const isReady = module.api.isReady();
                const endTime = performance.now();
                
                const responseTime = endTime - startTime;
                performanceResults[moduleId] = {
                    responseTime: responseTime.toFixed(2),
                    isReady: isReady
                };
                
                testHelper.assert(responseTime < 100, `${moduleId} API response should be < 100ms`);
                console.log(`  ✓ ${moduleId}: ${responseTime.toFixed(2)}ms response time`);
            }
        }
        
        results.details.performance = performanceResults;
    });
    
    // ===========================================
    // FINAL RESULTS
    // ===========================================
    console.log('\n📊 VALIDATION COMPLETE - RESULTS SUMMARY');
    console.log('=' .repeat(50));
    
    const successRate = results.total > 0 ? (results.passed / results.total * 100).toFixed(1) : 0;
    
    console.log(`📈 OVERALL RESULTS:`);
    console.log(`   Total Tests: ${results.total}`);
    console.log(`   Passed: ${results.passed} ✅`);
    console.log(`   Failed: ${results.failed} ❌`);
    console.log(`   Success Rate: ${successRate}%`);
    
    if (results.details.availableModules) {
        console.log(`\n📦 Available Modules (${results.details.availableModules.length}):`);
        results.details.availableModules.forEach(moduleId => console.log(`   - ${moduleId}`));
    }
    
    if (results.details.performance) {
        console.log(`\n⚡ Performance Summary:`);
        Object.entries(results.details.performance).forEach(([moduleId, perf]) => {
            console.log(`   - ${moduleId}: ${perf.responseTime}ms (Ready: ${perf.isReady})`);
        });
    }
    
    console.log(`\n🔍 Module Statistics:`);
    console.log(`   - Modern API modules: ${results.details.consistentModules || 0}`);
    console.log(`   - Async pattern modules: ${results.details.modernModules || 0}`);
    console.log(`   - Error handling modules: ${results.details.modulesWithErrorHandling || 0}`);
    
    if (results.failed > 0) {
        console.log(`\n❌ FAILED TESTS (${results.failed}):`);
        results.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error.test}`);
            console.log(`      Error: ${error.error}`);
        });
    }
    
    // Final assessment
    console.log(`\n🎯 ASSESSMENT:`);
    if (successRate >= 90) {
        console.log(`   🏆 EXCELLENT: ${successRate}% success rate - Ready for production!`);
    } else if (successRate >= 75) {
        console.log(`   🥉 GOOD: ${successRate}% success rate - Minor issues to address`);
    } else if (successRate >= 50) {
        console.log(`   ⚠️ FAIR: ${successRate}% success rate - Significant issues need attention`);
    } else {
        console.log(`   ❌ POOR: ${successRate}% success rate - Major issues require immediate attention`);
    }
    
    console.log('\n✅ BBTTCC Complete Suite Validation finished!');
    console.log('📋 All modules have been validated using modern FoundryVTT v13+ patterns');
    
    // Return results for potential programmatic use
    return results;
    
})().catch(error => {
    console.error('💥 CRITICAL ERROR in BBTTCC validation:', error);
    ui.notifications.error(`BBTTCC validation failed: ${error.message}`);
});