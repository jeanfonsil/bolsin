'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface DebugInfo {
  timestamp: string
  route: string
  userAgent: string
  viewport: string
  errors: string[]
  warnings: string[]
}

export function DebugPanel() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const info: DebugInfo = {
      timestamp: new Date().toISOString(),
      route: window.location.pathname,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      errors: [],
      warnings: []
    }

    const originalError = console.error
    const originalWarn = console.warn

    console.error = (...args) => {
      info.errors.push(args.join(' '))
      originalError(...args)
    }

    console.warn = (...args) => {
      info.warnings.push(args.join(' '))
      originalWarn(...args)
    }

    setDebugInfo(info)

    return () => {
      console.error = originalError
      console.warn = originalWarn
    }
  }, [])

  const testComponents = () => {
    console.log('🔍 Testando componentes shadcn...')
    
    const tests = [
      { name: 'Button', test: () => !!Button },
      { name: 'Card', test: () => !!Card },
      { name: 'Badge', test: () => !!Badge },
    ]

    tests.forEach(({ name, test }) => {
      try {
        const result = test()
        console.log(`✅ ${name}: ${result ? 'OK' : 'FALHOU'}`)
      } catch (error) {
        console.error(`❌ ${name}: ${error}`)
      }
    })
  }

  const checkEnvironment = () => {
    console.log('🔍 Verificando ambiente...')
    console.log('Node env:', process.env.NODE_ENV)
    console.log('Database URL:', process.env.DATABASE_URL ? '✅ Configurado' : '❌ Não configurado')
    console.log('OpenAI Key:', process.env.OPENAI_API_KEY ? '✅ Configurado' : '❌ Não configurado')
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-red-500 text-white hover:bg-red-600"
        >
          🐛 Debug
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="bg-white border-2 border-red-500 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-red-600 flex items-center space-x-2">
              <span>🐛</span>
              <span>Debug Panel</span>
            </CardTitle>
            <Button
              onClick={() => setIsVisible(false)}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-2">Status do Sistema</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Rota:</span>
                <Badge variant="secondary" className="text-xs">{debugInfo?.route}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Viewport:</span>
                <Badge variant="secondary" className="text-xs">{debugInfo?.viewport}</Badge>
              </div>
            </div>
          </div>

          {debugInfo && debugInfo.errors && debugInfo.errors.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2 text-red-600">
                Erros ({debugInfo.errors.length})
              </h4>
              <div className="max-h-20 overflow-y-auto text-xs bg-red-50 p-2 rounded">
                {debugInfo.errors.map((error, i) => (
                  <div key={i} className="text-red-700">{error}</div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={testComponents}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              Testar Components
            </Button>
            
            <Button
              onClick={checkEnvironment}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              Check Env
            </Button>
          </div>

          <div className="text-xs text-gray-500">
            <div><kbd>F12</kbd> - DevTools</div>
            <div><kbd>Ctrl+R</kbd> - Refresh</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}