from setuptools import setup, find_packages
import sys, os

version = '0.1'

setup(
    name='ckanext-timeline',
    version=version,
    description="CKAN extension for timeline",
    long_description=
    """
    """,
    classifiers=[],  # Get strings from http://pypi.python.org/pypi?%3Aaction=list_classifiers
    keywords='',
    author='Mikael Karlsson',
    author_email='i8myshoes@gmail.com',
    url='',
    license='AGPLv3',
    packages=find_packages(exclude=['ez_setup', 'examples', 'tests']),
    namespace_packages=['ckanext', 'ckanext.timeline'],
    include_package_data=True,
    zip_safe=False,
    install_requires=[
        # -*- Extra requirements: -*-
    ],
    entry_points=
    """
    [ckan.plugins]
    # Add plugins here, eg
    # myplugin=ckanext.timeline:PluginClass
    timeline=ckanext.timeline.plugin:TimelinePlugin
    """,
)
